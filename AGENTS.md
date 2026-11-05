<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Accounts are created only by the admin (public signup disabled); usernames map to a synthetic email via src/lib/username.ts — keeps login username-only.
- Machine visibility is enforced by RLS (machines + machine_access); admin user management runs in server functions with the service-role client after a role check.
- Native apps are a Capacitor shell loading the published URL — so new machines/clients never need a store update.
- Contact intake uses shared schema validation and a dedicated public server function with server-only insert; only admins can read stored messages through RLS, preventing public exposure of contact details.
- Work reports (partes de trabajo) store the form as jsonb in work_reports; access gated by profiles.can_work_reports via the can_work_reports() RLS helper, toggled by admins — keeps form fields flexible without migrations.
- Closed-report edit requests go through the request_report_edit() security-definer RPC (owners can't update closed rows); admin approval reopens the report and sets edit_used so it happens once.
- Machine screens open in-app via @capacitor/inappbrowser openInWebView on native (top-level webview, so X-Frame-Options portals work); web falls back to a new tab. Opens are logged to machine_opens (admin-read RLS) plus project.machine_opened.
