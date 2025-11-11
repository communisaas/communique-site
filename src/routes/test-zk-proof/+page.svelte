<script lang="ts">
	import { onMount } from 'svelte';
	import {
		initializeProver,
		generateMockProof,
		isProverInitialized,
		getInitMetrics,
		isWasmSupported,
		getBrowserCompatibility
	} from '$lib/core/proof/prover';

	// Test state
	let testResults: {
		wasmSupported: boolean | null;
		wasmLoaded: boolean;
		proverInitialized: boolean;
		initTime: number | null;
		cachedTime: number | null;
		proofTime: number | null;
		proofSize: number | null;
		benchmarkTimes: number[];
		errors: string[];
	} = $state({
		wasmSupported: null,
		wasmLoaded: false,
		proverInitialized: false,
		initTime: null,
		cachedTime: null,
		proofTime: null,
		proofSize: null,
		benchmarkTimes: [],
		errors: []
	});

	let isTestRunning = $state(false);
	let currentTest = $state<string | null>(null);

	onMount(() => {
		// Check WASM support on mount
		testResults.wasmSupported = isWasmSupported();
		const compat = getBrowserCompatibility();
		console.log('[ZK Test] Browser compatibility:', compat);
	});

	async function runTest1() {
		if (isTestRunning) return;
		isTestRunning = true;
		currentTest = 'test1';
		testResults.errors = [];

		try {
			console.log('[Test 1] Checking WASM support...');
			const { Prover } = await import('@voter-protocol/halo2-browser-prover');

			if (Prover) {
				testResults.wasmLoaded = true;
				console.log('[Test 1] ✅ WASM module loaded');
			}
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error);
			testResults.errors.push(`Test 1: ${errMsg}`);
			console.error('[Test 1] ❌ Failed:', error);
		} finally {
			isTestRunning = false;
			currentTest = null;
		}
	}

	async function runTest2() {
		if (isTestRunning) return;
		if (!testResults.wasmLoaded) {
			testResults.errors.push('Run Test 1 first');
			return;
		}

		isTestRunning = true;
		currentTest = 'test2';

		try {
			console.log('[Test 2] Initializing prover (cold start)...');
			const startTime = performance.now();
			await initializeProver(14);
			const initTime = performance.now() - startTime;

			testResults.initTime = initTime;
			testResults.proverInitialized = isProverInitialized();

			const metrics = getInitMetrics();
			console.log('[Test 2] ✅ Prover initialized:', {
				initTime: `${initTime.toFixed(0)}ms`,
				metrics
			});
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error);
			testResults.errors.push(`Test 2: ${errMsg}`);
			console.error('[Test 2] ❌ Failed:', error);
		} finally {
			isTestRunning = false;
			currentTest = null;
		}
	}

	async function runTest3() {
		if (isTestRunning) return;
		if (!testResults.proverInitialized) {
			testResults.errors.push('Run Test 2 first');
			return;
		}

		isTestRunning = true;
		currentTest = 'test3';

		try {
			console.log('[Test 3] Testing cached initialization...');
			const startTime = performance.now();
			await initializeProver(14); // Should be instant
			const cachedTime = performance.now() - startTime;

			testResults.cachedTime = cachedTime;
			console.log('[Test 3] ✅ Cached init:', `${cachedTime.toFixed(2)}ms`);
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error);
			testResults.errors.push(`Test 3: ${errMsg}`);
			console.error('[Test 3] ❌ Failed:', error);
		} finally {
			isTestRunning = false;
			currentTest = null;
		}
	}

	async function runTest4() {
		if (isTestRunning) return;
		if (!testResults.proverInitialized) {
			testResults.errors.push('Run Test 2 first');
			return;
		}

		isTestRunning = true;
		currentTest = 'test4';

		try {
			console.log('[Test 4] Generating mock proof...');
			const result = await generateMockProof('CA-12');

			testResults.proofTime = result.generationTime;
			testResults.proofSize = result.proof.length;

			console.log('[Test 4] ✅ Proof generated:', {
				time: `${result.generationTime}ms`,
				size: `${result.proof.length} bytes`,
				district: result.district
			});
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error);
			testResults.errors.push(`Test 4: ${errMsg}`);
			console.error('[Test 4] ❌ Failed:', error);
		} finally {
			isTestRunning = false;
			currentTest = null;
		}
	}

	async function runTest5() {
		if (isTestRunning) return;
		if (!testResults.proverInitialized) {
			testResults.errors.push('Run Test 2 first');
			return;
		}

		isTestRunning = true;
		currentTest = 'test5';
		testResults.benchmarkTimes = [];

		try {
			console.log('[Test 5] Running benchmark (3 proofs)...');

			for (let i = 0; i < 3; i++) {
				const result = await generateMockProof(`CA-${i + 1}`);
				testResults.benchmarkTimes.push(result.generationTime);
				console.log(`[Test 5] Proof ${i + 1}: ${result.generationTime}ms`);
			}

			const avg = testResults.benchmarkTimes.reduce((a, b) => a + b, 0) / 3;
			console.log('[Test 5] ✅ Benchmark complete:', {
				average: `${avg.toFixed(0)}ms`,
				times: testResults.benchmarkTimes.map((t) => `${t}ms`)
			});
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error);
			testResults.errors.push(`Test 5: ${errMsg}`);
			console.error('[Test 5] ❌ Failed:', error);
		} finally {
			isTestRunning = false;
			currentTest = null;
		}
	}

	async function runAllTests() {
		await runTest1();
		await new Promise((resolve) => setTimeout(resolve, 500));
		await runTest2();
		await new Promise((resolve) => setTimeout(resolve, 500));
		await runTest3();
		await new Promise((resolve) => setTimeout(resolve, 500));
		await runTest4();
		await new Promise((resolve) => setTimeout(resolve, 500));
		await runTest5();
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
	<div class="mx-auto max-w-4xl">
		<div class="mb-8 rounded-2xl bg-white p-8 shadow-xl">
			<h1 class="mb-4 text-4xl font-bold text-slate-900">🔐 ZK Proof Generation Test Suite</h1>
			<p class="text-slate-600">
				Browser-native Halo2 WASM proving with @voter-protocol/halo2-browser-prover
			</p>

			<div class="mt-6 flex gap-4">
				<button
					onclick={runAllTests}
					disabled={isTestRunning}
					class="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-all hover:bg-blue-700 disabled:bg-slate-400"
				>
					{isTestRunning ? '⏳ Running...' : '▶️ Run All Tests'}
				</button>
			</div>
		</div>

		<!-- Browser Compatibility -->
		<div class="mb-6 rounded-2xl bg-white p-6 shadow-xl">
			<h2 class="mb-4 text-2xl font-bold text-slate-900">Browser Compatibility</h2>
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<span class="text-2xl">
						{testResults.wasmSupported === null ? '⏳' : testResults.wasmSupported ? '✅' : '❌'}
					</span>
					<span class="text-slate-700">
						WebAssembly Support: {testResults.wasmSupported === null
							? 'Checking...'
							: testResults.wasmSupported
								? 'Supported'
								: 'Not Supported'}
					</span>
				</div>
			</div>
		</div>

		<!-- Test 1: Load WASM -->
		<div class="mb-6 rounded-2xl bg-white p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-2xl font-bold text-slate-900">Test 1: Load WASM Module</h2>
				<button
					onclick={runTest1}
					disabled={isTestRunning}
					class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:bg-slate-400"
				>
					{currentTest === 'test1' ? '⏳ Running...' : 'Run Test'}
				</button>
			</div>
			<p class="mb-4 text-slate-600">
				Verify @voter-protocol/halo2-browser-prover can be imported.
			</p>
			<div class="rounded-lg bg-slate-50 p-4">
				<div class="flex items-center gap-2">
					<span class="text-2xl">{testResults.wasmLoaded ? '✅' : '⏳'}</span>
					<span class="font-mono text-sm text-slate-700">
						{testResults.wasmLoaded ? 'WASM module loaded' : 'Not loaded yet'}
					</span>
				</div>
			</div>
		</div>

		<!-- Test 2: Initialize Prover -->
		<div class="mb-6 rounded-2xl bg-white p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-2xl font-bold text-slate-900">Test 2: Initialize Prover (Cold Start)</h2>
				<button
					onclick={runTest2}
					disabled={isTestRunning || !testResults.wasmLoaded}
					class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:bg-slate-400"
				>
					{currentTest === 'test2' ? '⏳ Running...' : 'Run Test'}
				</button>
			</div>
			<p class="mb-4 text-slate-600">First initialization (5-10s keygen).</p>
			<div class="rounded-lg bg-slate-50 p-4">
				{#if testResults.initTime !== null}
					<div class="space-y-2">
						<div class="flex items-center gap-2">
							<span class="text-2xl">✅</span>
							<span class="font-mono text-sm text-slate-700">
								Initialization: {testResults.initTime.toFixed(0)}ms ({(
									testResults.initTime / 1000
								).toFixed(1)}s)
							</span>
						</div>
						{#if testResults.initTime < 10000}
							<div class="flex items-center gap-2">
								<span class="text-2xl">🚀</span>
								<span class="text-sm text-green-700">Excellent performance (&lt; 10s)</span>
							</div>
						{:else if testResults.initTime < 30000}
							<div class="flex items-center gap-2">
								<span class="text-2xl">✓</span>
								<span class="text-sm text-blue-700">Acceptable performance (&lt; 30s)</span>
							</div>
						{:else}
							<div class="flex items-center gap-2">
								<span class="text-2xl">⚠️</span>
								<span class="text-sm text-orange-700">Slow performance (&gt; 30s)</span>
							</div>
						{/if}
					</div>
				{:else}
					<span class="font-mono text-sm text-slate-500">Not run yet</span>
				{/if}
			</div>
		</div>

		<!-- Test 3: Cached Init -->
		<div class="mb-6 rounded-2xl bg-white p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-2xl font-bold text-slate-900">Test 3: Initialize Prover (Cached)</h2>
				<button
					onclick={runTest3}
					disabled={isTestRunning || !testResults.proverInitialized}
					class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:bg-slate-400"
				>
					{currentTest === 'test3' ? '⏳ Running...' : 'Run Test'}
				</button>
			</div>
			<p class="mb-4 text-slate-600">Second call should be instant (&lt;100ms).</p>
			<div class="rounded-lg bg-slate-50 p-4">
				{#if testResults.cachedTime !== null}
					<div class="flex items-center gap-2">
						<span class="text-2xl">
							{testResults.cachedTime < 100 ? '✅' : '⚠️'}
						</span>
						<span class="font-mono text-sm text-slate-700">
							Cached access: {testResults.cachedTime.toFixed(2)}ms
						</span>
					</div>
				{:else}
					<span class="font-mono text-sm text-slate-500">Not run yet</span>
				{/if}
			</div>
		</div>

		<!-- Test 4: Generate Proof -->
		<div class="mb-6 rounded-2xl bg-white p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-2xl font-bold text-slate-900">Test 4: Generate Mock Proof</h2>
				<button
					onclick={runTest4}
					disabled={isTestRunning || !testResults.proverInitialized}
					class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:bg-slate-400"
				>
					{currentTest === 'test4' ? '⏳ Running...' : 'Run Test'}
				</button>
			</div>
			<p class="mb-4 text-slate-600">Generate proof (1-2s desktop, 8-15s mobile).</p>
			<div class="rounded-lg bg-slate-50 p-4">
				{#if testResults.proofTime !== null}
					<div class="space-y-2">
						<div class="flex items-center gap-2">
							<span class="text-2xl">✅</span>
							<span class="font-mono text-sm text-slate-700">
								Generation: {testResults.proofTime}ms ({(testResults.proofTime / 1000).toFixed(1)}s)
							</span>
						</div>
						<div class="flex items-center gap-2">
							<span class="text-2xl">📦</span>
							<span class="font-mono text-sm text-slate-700">
								Proof size: {testResults.proofSize} bytes
							</span>
						</div>
						{#if testResults.proofTime < 2000}
							<div class="flex items-center gap-2">
								<span class="text-2xl">🚀</span>
								<span class="text-sm text-green-700">Desktop-class performance</span>
							</div>
						{:else if testResults.proofTime < 15000}
							<div class="flex items-center gap-2">
								<span class="text-2xl">✓</span>
								<span class="text-sm text-blue-700">Mobile-class performance</span>
							</div>
						{/if}
					</div>
				{:else}
					<span class="font-mono text-sm text-slate-500">Not run yet</span>
				{/if}
			</div>
		</div>

		<!-- Test 5: Benchmark -->
		<div class="mb-6 rounded-2xl bg-white p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-2xl font-bold text-slate-900">Test 5: Performance Benchmark</h2>
				<button
					onclick={runTest5}
					disabled={isTestRunning || !testResults.proverInitialized}
					class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:bg-slate-400"
				>
					{currentTest === 'test5' ? '⏳ Running...' : 'Run Test'}
				</button>
			</div>
			<p class="mb-4 text-slate-600">Generate 3 proofs and measure average time.</p>
			<div class="rounded-lg bg-slate-50 p-4">
				{#if testResults.benchmarkTimes.length > 0}
					<div class="space-y-2">
						{#each testResults.benchmarkTimes as time, i}
							<div class="flex items-center gap-2">
								<span class="font-mono text-sm text-slate-700">Proof {i + 1}: {time}ms</span>
							</div>
						{/each}
						<div class="mt-4 flex items-center gap-2 border-t border-slate-200 pt-4">
							<span class="text-2xl">✅</span>
							<span class="font-mono text-sm font-bold text-slate-900">
								Average: {(testResults.benchmarkTimes.reduce((a, b) => a + b, 0) / 3).toFixed(0)}ms
							</span>
						</div>
					</div>
				{:else}
					<span class="font-mono text-sm text-slate-500">Not run yet</span>
				{/if}
			</div>
		</div>

		<!-- Errors -->
		{#if testResults.errors.length > 0}
			<div class="rounded-2xl bg-red-50 p-6 shadow-xl">
				<h2 class="mb-4 text-2xl font-bold text-red-900">Errors</h2>
				<div class="space-y-2">
					{#each testResults.errors as error}
						<div class="rounded-lg bg-white p-3 font-mono text-sm text-red-700">{error}</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
