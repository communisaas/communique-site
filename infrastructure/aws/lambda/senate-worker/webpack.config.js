const path = require('path');

module.exports = {
	entry: './index.ts',
	target: 'node',
	mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',

	module: {
		rules: [
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: /node_modules/
			}
		]
	},

	resolve: {
		extensions: ['.ts', '.js']
	},

	output: {
		filename: 'index.js',
		path: path.resolve(__dirname, 'dist'),
		library: {
			type: 'commonjs2'
		},
		clean: true
	},

	optimization: {
		minimize: true,
		usedExports: true,
		sideEffects: false
	},

	externals: {
		// AWS SDK v3 is provided by Lambda runtime for Node.js 18+
		'@aws-sdk/client-dynamodb': 'commonjs @aws-sdk/client-dynamodb',
		'@aws-sdk/lib-dynamodb': 'commonjs @aws-sdk/lib-dynamodb',
		'aws-lambda': 'commonjs aws-lambda'
	},

	// Lambda-specific optimizations
	performance: {
		hints: false // Disable performance warnings for Lambda bundles
	},

	stats: {
		colors: true,
		chunks: false,
		modules: false,
		hash: false,
		version: false,
		timings: true,
		assets: true,
		builtAt: false
	},

	plugins: [],

	devtool: process.env.NODE_ENV === 'production' ? false : 'source-map'
};
