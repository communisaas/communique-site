import { Handler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ServiceDiscoveryClient, DiscoverInstancesCommand } from '@aws-sdk/client-servicediscovery';
import https from 'https';
import http from 'http';

const serviceDiscovery = new ServiceDiscoveryClient({});

export const handler: Handler = async (
	event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
	console.log('Received event:', JSON.stringify(event, null, 2));

	try {
		// 1. Discover healthy TEE instances
		const namespace = process.env.TEE_NAMESPACE;
		const serviceName = process.env.TEE_SERVICE_NAME;

		if (!namespace || !serviceName) {
			throw new Error('Missing TEE_NAMESPACE or TEE_SERVICE_NAME environment variables');
		}

		const command = new DiscoverInstancesCommand({
			NamespaceName: namespace,
			ServiceName: serviceName,
			HealthStatus: 'HEALTHY',
			MaxResults: 10
		});

		const response = await serviceDiscovery.send(command);
		const instances = response.Instances || [];

		if (instances.length === 0) {
			console.error('No healthy TEE instances found');
			return {
				statusCode: 503,
				body: JSON.stringify({ error: 'Service Unavailable: No healthy TEE instances found' })
			};
		}

		// 2. Load Balance (Random for now)
		const instance = instances[Math.floor(Math.random() * instances.length)];
		const ip = instance.Attributes?.AWS_INSTANCE_IPV4;
		const port = 8080; // Assuming TEE proxy listens on 8080

		if (!ip) {
			console.error('Instance found but missing IP address', instance);
			return {
				statusCode: 500,
				body: JSON.stringify({ error: 'Internal Server Error: TEE instance missing IP' })
			};
		}

		console.log(`Forwarding request to TEE instance: ${ip}:${port}`);

		// 3. Forward Request
		const result = await forwardRequest(ip, port, event.body || '', event.headers);

		return {
			statusCode: result.statusCode,
			headers: result.headers,
			body: result.body
		};
	} catch (error) {
		console.error('Error processing request:', error);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: 'Internal Server Error' })
		};
	}
};

async function forwardRequest(
	ip: string,
	port: number,
	body: string,
	headers: any
): Promise<{ statusCode: number; headers: any; body: string }> {
	return new Promise((resolve, reject) => {
		const options = {
			hostname: ip,
			port: port,
			path: '/submit', // Assuming endpoint
			method: 'POST',
			headers: {
				...headers,
				Host: ip // Update Host header
			}
		};

		const req = http.request(options, (res) => {
			let data = '';
			res.on('data', (chunk) => (data += chunk));
			res.on('end', () => {
				resolve({
					statusCode: res.statusCode || 500,
					headers: res.headers,
					body: data
				});
			});
		});

		req.on('error', (e) => {
			console.error(`Problem with request: ${e.message}`);
			reject(e);
		});

		req.write(body);
		req.end();
	});
}
