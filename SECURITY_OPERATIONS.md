# Security Operations

## Admin Account Changes

Admin access is controlled by `public.admin_users`. A user must already exist in
Supabase Auth before being added to this table.

### Add an admin

1. Open Supabase Dashboard.
2. Confirm the target user in Authentication > Users and copy the user ID.
3. Run this SQL in the production project:

```sql
insert into public.admin_users (id, role)
values ('USER_UUID_HERE', 'admin')
on conflict (id) do update set role = excluded.role;
```

Use `role = 'kyc_reviewer'` only for staff who need access to identity document
review endpoints.

### Remove an admin

Run this SQL in the production project:

```sql
delete from public.admin_users
where id = 'USER_UUID_HERE';
```

After removal, ask the user to sign out. If the account is compromised, also
revoke or delete the Supabase Auth user session from the Dashboard.

## Backup Policy

- Supabase PITR or scheduled database backups must be enabled for Production.
- Keep at least 7 daily restore points for normal operations.
- Before schema migrations that touch orders, profiles, admin users, or identity
  documents, take a manual backup or confirm the latest automated backup time.
- Test restore into a non-production Supabase project at least once per quarter.
- Storage bucket contents are part of operational data. Keep `identity-images`
  private and confirm object recovery is covered by the storage backup process.

## Environment Separation

- Production and Preview must use different Supabase projects.
- Preview may use copied anonymized data only; do not point Preview at the
  Production database.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `CRON_SECRET` scoped to
  server environments only. Do not create `NEXT_PUBLIC_` variants of secrets.

## Admin Domain And Indexing

- Set `ADMIN_ALLOWED_HOSTS` to the allowed admin host names.
- `/admin` and `/api/admin` responses set `X-Robots-Tag: noindex, nofollow,
  noarchive`.
- Admin layouts also export `robots: { index: false, follow: false }`.

## Rate Limiting

The app includes in-process fixed-window rate limits for public API routes,
auth-related Server Actions, admin mutations, and admin API routes. For stronger
multi-region enforcement, also configure Vercel Firewall rate limiting for:

- `/api/cards`
- `/api/orders/:path*`
- `/api/admin/:path*`
- login, register, and password-reset pages

## Error Notification

Order and email notification failures log sanitized details. Production should
also have a Vercel or external monitoring alert for repeated function errors and
5xx responses.
