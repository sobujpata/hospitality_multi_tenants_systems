# Production deployment checklist

- Copy `deploy/.env.production.example` to the server `.env`, fill every secret, and run `php artisan config:cache`.
- Enable PHP 8.3 extensions required by the application, including `zip`, `pcntl`, and `posix`.
- Run `php artisan migrate --force`, `php artisan storage:link`, and `npm run build`.
- Configure the S3 bucket CORS from `deploy/s3-cors.json`; keep the bucket private and use signed URLs where appropriate.
- Run `php artisan horizon` under `deploy/horizon-supervisor.conf` (or the queue-worker systemd service).
- Run `php artisan schedule:work` as a supervised process so dashboard refresh, reports, reminders, and trial prompts execute.
- Run `php artisan reverb:start` behind TLS/reverse proxy for real-time notifications.
- Point custom tenant domains to the application, provision TLS certificates, and verify the Enterprise tenant's `custom_domain`.
- Configure Stripe webhooks, SES sending/verification, Redis persistence, database backups, and log rotation before accepting production traffic.
