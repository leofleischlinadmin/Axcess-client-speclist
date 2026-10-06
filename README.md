# Axcess Client Selections (Netlify version)

Clients sign in, see their projects, create new ones, and fill in selections. Everything is saved to your Netlify account (Identity for sign-in, Blobs for data and photos).

## One-time setup

1. **Put this folder on GitHub.** Create a free repository and upload everything in this folder (keep the folder structure: `public/`, `netlify/functions/`, `src/`, `package.json`, `netlify.toml`).
2. **Create the Netlify site from GitHub.** Netlify > Add new project > Import an existing project > pick the repo. Netlify reads `netlify.toml`, so leave the build settings as detected. (Drag-and-drop deploys will NOT work: this site has a build step and a function.)
3. **Enable Identity.** In the project, open Identity > Enable Identity.
4. **Make signup invite-only** (recommended). Identity settings > Registration > Invite only. Then invite each client by email from Identity > Invite users.
5. **Make yourself an admin.** Sign up / accept your own invite, open your user in Identity, and add the role `admin`. Admins see every client's projects (shown with the client's email); everyone else sees only their own.
6. **Test with a second email** before sending anything to clients: create a project, add a photo, tick items, then check you can see it from your admin account.

Invited clients open the acceptance link in their invitation email and choose a password (at least 8 characters, entered twice). Saving the password accepts the invitation and signs them in. They can then log in with their invited email and that password. If an invitation has expired, send a new invitation from Identity. Existing users can use **Forgot password?** to reset their password.

## Notes
- Confirmation emails come from a generic Netlify address on the free plan. Branded emails need the Pro plan.
- Roles take effect at the user's next login.
- Photos are shrunk in the browser to about 1000px before upload.
- The "Download my selections" button still produces the Excel file (zip with photos).
