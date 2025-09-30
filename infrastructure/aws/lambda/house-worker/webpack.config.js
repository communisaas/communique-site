const path = require('path');

module.exports = {
	entry: './index.ts',
	target: 'node',
	mode: 'production',
	optimization: {
		minimize: false // Keep readable for debugging
	},
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
		libraryTarget: 'commonjs2'
	},
	externals: [
		// AWS SDK is provided by Lambda runtime
		/^@aws-sdk\/.*/,
		'aws-sdk'
	],
	stats: {
		warningsFilter: [
			// Suppress specific warnings that are safe to ignore
			/Critical dependency: the request of a dependency is an expression/
		]
	}
};
