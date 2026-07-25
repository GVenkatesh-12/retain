import { createHash } from 'node:crypto';
import { serve } from '@hono/node-server';
import { issuer } from '@openauthjs/openauth';
import { PasswordProvider } from '@openauthjs/openauth/provider/password';
import { MemoryStorage } from '@openauthjs/openauth/storage/memory';
import { PasswordUI } from '@openauthjs/openauth/ui/password';
import { Resend } from 'resend';
import { subjects } from './subjects.js';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey && resendApiKey !== 're_xxxxxxxxx' ? new Resend(resendApiKey) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';

export const authApp = issuer({
  subjects,
  // File-backed storage keeps local development sessions across restarts. Use a durable
  // OpenAuth storage adapter before deploying multiple auth instances.
  storage: MemoryStorage({ persist: process.env.OPENAUTH_STORAGE ?? '.retain-auth.json' }),
  providers: {
    // Retain intentionally exposes only email/password authentication.
    password: PasswordProvider(
      PasswordUI({
        copy: {
          logo: 'Retain',
          login_title: 'Welcome back to Retain',
          login_description: 'Sign in with your email and password to continue.',
          register: 'Create account',
          register_prompt: 'New to Retain?',
          login_prompt: 'Already have an account?',
        },
        validatePassword: (password) => password.length < 8 ? 'Password must be at least 8 characters.' : undefined,
        sendCode: async (email, code) => {
          console.info(`[Retain auth] verification code for ${email}: ${code}`);

          if (resend) {
            try {
              const { error } = await resend.emails.send({
                from: fromEmail,
                to: email,
                subject: 'Your Retain Verification Code',
                html: `
                  <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #dfe6df; border-radius: 12px; background: #ffffff;">
                    <div style="font-size: 20px; font-weight: 700; color: #557b67; margin-bottom: 16px;">retain</div>
                    <h2 style="font-size: 20px; color: #27332d; margin-bottom: 8px;">Your verification code</h2>
                    <p style="color: #77817a; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">Use the code below to complete your sign in or registration for Retain:</p>
                    <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #355a47; background: #eef3ed; padding: 14px 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">${code}</div>
                    <p style="color: #77817a; font-size: 12px;">If you didn't request this code, you can safely ignore this email.</p>
                  </div>
                `,
              });
              if (error) {
                console.error('[Retain auth] Resend error:', error);
              } else {
                console.info(`[Retain auth] Verification email sent to ${email} via Resend.`);
              }
            } catch (err) {
              console.error('[Retain auth] Failed to send email via Resend:', err);
            }
          }
        },
      }),
    ),
  },
  success: async (ctx, value) => {
    if (value.provider !== 'password') throw new Error('Unsupported authentication provider');
    const email = value.email.toLowerCase();
    const id = `user-${createHash('sha256').update(email).digest('hex').slice(0, 24)}`;
    return ctx.subject('user', { id, email });
  },
});

const authPort = Number(process.env.AUTH_PORT ?? 3001);
const authHost = process.env.AUTH_HOST ?? process.env.HOST ?? '0.0.0.0';

serve({ fetch: authApp.fetch, port: authPort, hostname: authHost }, (info) => {
  console.info(`Retain email/password auth listening on http://${info.address}:${info.port}`);
});
