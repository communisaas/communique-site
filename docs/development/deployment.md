# Deployment Guide

For comprehensive deployment documentation, see:

- **[AWS Deployment Guide](./aws-deployment.md)** - Full AWS Nitro Enclaves deployment (includes pre-deployment checklist)

## Quick Reference

```bash
npm run build        # Verify production build
npm run test         # Run test suite
npx wrangler pages deploy .svelte-kit/cloudflare  # Deploy to Cloudflare Pages
```

For detailed AWS infrastructure setup, TEE configuration, and monitoring, see the AWS Deployment Guide.
