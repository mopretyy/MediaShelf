import { ArrowLeft, ArrowRight, Check, MailCheck, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { loginSchema, registerStartSchema } from '@shared/schemas.ts'
import { BrandMark } from '@/app/Brand'
import { PinPad } from '@/components/PinPad'
import { Button } from '@/components/ui/button'
import { Field, Input, PasswordInput } from '@/components/ui/input'
import { useI18n, type MessageKey } from '@/i18n'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useDocumentTitle } from '@/lib/hooks'
import {
  useLogin,
  useRegisterResend,
  useRegisterStart,
  useRegisterVerify,
  useSession,
} from '@/lib/queries'
import { useTheme } from '@/lib/theme'
import { AuthPosterStrip, AuthShowcase } from './auth/AuthShowcase'

type Errors = Partial<Record<'name' | 'email' | 'password' | 'form', string>>

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { t, locale } = useI18n()
  const { preference } = useTheme()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { registrationOpen } = useSession()
  const login = useLogin()
  const start = useRegisterStart()
  const verify = useRegisterVerify()
  const resend = useRegisterResend()
  const [errors, setErrors] = useState<Errors>({})
  // Step two of registration: the code from the email.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [delivered, setDelivered] = useState(true)
  const [codeStatus, setCodeStatus] = useState<'idle' | 'error' | 'success'>('idle')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const isLogin = mode === 'login'
  useDocumentTitle(isLogin ? t('nav.signIn') : t('nav.signUp'))

  useEffect(() => {
    if (!cooldown) return
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const next = params.get('next')
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const suffix = next ? `?next=${encodeURIComponent(next)}` : ''

  const fieldError = (code: string | undefined) =>
    code ? t(`errors.fields.${code}` as MessageKey) : undefined

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    }
    const parsed = (isLogin ? loginSchema : registerStartSchema).safeParse(values)
    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]) as keyof Errors
        next[key] ??= fieldError(/^[a-z_]+$/.test(issue.message) ? issue.message : 'invalid')
      }
      setErrors(next)
      return
    }
    setErrors({})
    const onError = (error: unknown) => {
      if (error instanceof ApiError) {
        const fields: Errors = {}
        for (const [key, code] of Object.entries(error.fields))
          fields[key as keyof Errors] = fieldError(code)
        setErrors({
          ...fields,
          form: Object.keys(fields).length
            ? undefined
            : t(
                error.code === 'NETWORK'
                  ? 'errors.network'
                  : (`errors.${error.code}` as MessageKey),
              ),
        })
      } else setErrors({ form: t('errors.generic') })
    }
    if (isLogin)
      login.mutate(
        { email: values.email, password: values.password },
        { onSuccess: () => navigate(target, { replace: true }), onError },
      )
    else
      start.mutate(
        { ...values, locale, theme: preference },
        {
          onSuccess: (result) => {
            setPendingEmail(values.email)
            setDevCode(result.devCode ?? null)
            setDelivered(result.delivered)
            setCodeStatus('idle')
            setCodeError(null)
            setCooldown(result.delivered ? 60 : 0)
          },
          onError,
        },
      )
  }

  const submitCode = (code: string) => {
    if (!pendingEmail || verify.isPending) return
    verify.mutate(
      { email: pendingEmail, code, locale, theme: preference },
      {
        onSuccess: ({ user }) => {
          setCodeStatus('success')
          setTimeout(() => {
            toast(t('auth.welcome', { name: user.name }))
            const fresh =
              next && next.startsWith('/') && !next.startsWith('//') ? target : '/welcome'
            // Navigate first, then sign in: the route change wins over the guest-only guard.
            navigate(fresh, { replace: true })
            verify.signIn(user)
          }, 550)
        },
        onError: (error) => {
          setCodeStatus('error')
          setTimeout(() => setCodeStatus('idle'), 700)
          if (error instanceof ApiError) {
            setCodeError(
              t(
                error.code === 'NETWORK'
                  ? 'errors.network'
                  : (`errors.${error.code}` as MessageKey),
              ),
            )
            if (error.code === 'NO_PENDING' || error.code === 'CODE_EXPIRED') {
              setTimeout(() => setPendingEmail(null), 1500)
            }
          } else setCodeError(t('errors.generic'))
        },
      },
    )
  }

  const resendCode = () => {
    if (!pendingEmail || resend.isPending || cooldown) return
    resend.mutate(
      { email: pendingEmail },
      {
        onSuccess: (result) => {
          setDevCode(result.devCode ?? null)
          setDelivered(result.delivered)
          setCodeError(null)
          setCooldown(60)
          toast(t('auth.codeResent'))
        },
        onError: (error) => {
          if (error instanceof ApiError)
            setCodeError(
              t(
                error.code === 'NETWORK'
                  ? 'errors.network'
                  : (`errors.${error.code}` as MessageKey),
              ),
            )
          else setCodeError(t('errors.generic'))
        },
      },
    )
  }

  const pending = login.isPending || start.isPending
  const closed = !isLogin && !registrationOpen

  if (!isLogin && pendingEmail) {
    return (
      <AuthLayout
        back={
          <Button variant="ghost" size="sm" onClick={() => setPendingEmail(null)}>
            <ArrowLeft />
            {t('welcome.back')}
          </Button>
        }
      >
        <div className="animate-rise text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-raised ring-1 ring-line ring-inset">
            <MailCheck className="size-6 text-fg-2" />
          </span>
          <h1 className="display mt-6 text-3xl">{t('auth.codeTitle')}</h1>
          <p className="mt-2 text-md text-pretty text-fg-2">
            {t('auth.codeText', { email: pendingEmail })}
          </p>
          <button
            type="button"
            onClick={() => setPendingEmail(null)}
            className="mt-1.5 text-sm text-fg-3 transition-colors hover:text-fg hover:underline hover:underline-offset-4"
          >
            {t('auth.changeEmail')}
          </button>
          <div className="mt-8 grid place-items-center">
            <PinPad
              key={codeStatus === 'success' ? 'done' : 'live'}
              label={t('auth.codeTitle')}
              status={codeStatus}
              length={6}
              autoFocus
              onComplete={submitCode}
            />
          </div>
          {codeStatus === 'success' ? (
            <p
              role="status"
              className="mt-4 flex animate-fade-in items-center justify-center gap-1.5 text-sm text-fg-2"
            >
              <Check className="size-4" />
              {t('auth.codeAccepted')}
            </p>
          ) : null}
          {codeError ? (
            <p role="alert" className="mt-4 text-sm text-danger">
              {codeError}
            </p>
          ) : null}
          {!delivered && devCode ? (
            <p className="mx-auto mt-6 max-w-[320px] rounded-xl bg-raised px-4 py-3 text-sm text-fg-2 ring-1 ring-line ring-inset">
              {t('auth.devCodeHint')}{' '}
              <span className="tabular text-lg font-bold tracking-[0.2em] text-fg">{devCode}</span>
            </p>
          ) : null}
          <div className="mt-6">
            <Button
              variant="ghost"
              size="sm"
              disabled={Boolean(cooldown) || resend.isPending}
              loading={resend.isPending}
              onClick={resendCode}
            >
              {cooldown ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resend')}
            </Button>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="animate-rise">
        <AuthTabs mode={mode} suffix={suffix} />
        <h1 className="display mt-8 text-3xl">
          {isLogin ? t('auth.loginTitle') : t('auth.registerTitle')}
        </h1>
        <p className="mt-2 text-md text-pretty text-fg-2">
          {isLogin ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}
        </p>

        {closed ? (
          <p className="mt-8 rounded-xl bg-raised p-4 text-base text-fg-2 ring-1 ring-line ring-inset">
            {t('auth.closed')}
          </p>
        ) : (
          <form className="mt-8 grid gap-4" onSubmit={onSubmit} noValidate>
            {!isLogin ? (
              <Field label={t('auth.name')} error={errors.name}>
                {(props) => (
                  <Input
                    {...props}
                    name="name"
                    size="lg"
                    autoComplete="name"
                    placeholder={t('auth.namePlaceholder')}
                    maxLength={60}
                    autoFocus
                  />
                )}
              </Field>
            ) : null}
            <Field label={t('auth.email')} error={errors.email}>
              {(props) => (
                <Input
                  {...props}
                  name="email"
                  type="email"
                  size="lg"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  autoFocus={isLogin}
                />
              )}
            </Field>
            <Field
              label={t('auth.password')}
              error={errors.password}
              hint={!isLogin ? t('auth.passwordHint') : undefined}
            >
              {(props) => (
                <PasswordInput
                  {...props}
                  name="password"
                  size="lg"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
              )}
            </Field>
            {errors.form ? (
              <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">
                {errors.form}
              </p>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="mt-2 w-full"
              loading={pending}
            >
              {isLogin ? t('auth.login') : t('auth.register')}
              <ArrowRight />
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-fg-2">
          {isLogin ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
          <Link
            to={(isLogin ? '/register' : '/login') + suffix}
            className="font-medium text-fg underline-offset-4 hover:underline"
          >
            {isLogin ? t('auth.register') : t('auth.login')}
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

/** Two-pane frame: the form on the left, the poster showcase on the right (desktop only). */
function AuthLayout({ back, children }: { back?: ReactNode; children: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] bg-panel lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
      <div className="relative flex min-h-dvh min-w-0 flex-col">
        <div className="lg:hidden">
          <AuthPosterStrip />
        </div>
        <header className="flex h-16 items-center justify-between px-5 max-lg:absolute max-lg:inset-x-0 max-lg:top-0 lg:px-8">
          {back ?? (
            <Link
              to="/"
              className="flex items-center gap-2.5 rounded-lg text-md font-semibold tracking-tight"
            >
              <BrandMark className="size-8" />
              MediaShell
            </Link>
          )}
        </header>
        <main className="flex flex-1 items-start justify-center px-5 pb-12 max-lg:-mt-6 lg:items-center lg:px-8">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
        <footer className="flex items-center justify-center gap-2 px-5 pb-6 text-xs text-fg-3 lg:justify-start lg:px-8">
          <ShieldCheck className="size-3.5" />
          {t('auth.localNote')}
        </footer>
      </div>
      <aside className="sticky top-0 hidden h-dvh p-2 pl-0 lg:block">
        <AuthShowcase />
      </aside>
    </div>
  )
}

/** Sign in / Sign up switch. Links, so each mode keeps its own URL and the browser history. */
function AuthTabs({ mode, suffix }: { mode: 'login' | 'register'; suffix: string }) {
  const { t } = useI18n()
  const tabs = [
    { mode: 'login', to: '/login', label: t('auth.tabLogin') },
    { mode: 'register', to: '/register', label: t('auth.tabRegister') },
  ] as const
  return (
    <nav
      aria-label={t('auth.tabsLabel')}
      className="relative grid grid-cols-2 rounded-xl bg-raised p-1 ring-1 ring-line ring-inset"
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-panel shadow-card ring-1 ring-line ring-inset transition-transform duration-250 ease-out',
          mode === 'register' && 'translate-x-full',
        )}
      />
      {tabs.map((tab) => (
        <Link
          key={tab.mode}
          to={tab.to + suffix}
          replace
          aria-current={mode === tab.mode ? 'page' : undefined}
          className={cn(
            'relative z-10 rounded-lg py-2 text-center text-sm font-medium transition-colors',
            mode === tab.mode ? 'text-fg' : 'text-fg-3 hover:text-fg-2',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
