<script lang="ts">
  import { page } from '$app/stores';
</script>

<div class="min-h-screen bg-slate-50">
  <nav class="bg-white border-b border-slate-200">
    <div class="max-w-6xl mx-auto px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <a href="/" class="text-lg font-semibold text-slate-900">Communiqué</a>
          <span class="text-slate-400">→</span>
          <span class="text-slate-600">Analytics</span>
        </div>
        
        <div class="flex items-center space-x-4">
          <a href="/profile" 
             class="text-slate-600 hover:text-slate-900 transition-colors">
            Profile
          </a>
          <a href="/" 
             class="text-slate-600 hover:text-slate-900 transition-colors">
            Templates
          </a>
        </div>
      </div>
    </div>
  </nav>

  <main>
    <slot />
  </main>
</div>