import '../../styles/site/account.css';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from '../../lib/router.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { authApi } from '../../api/endpoints.js';
import { ErrorBox, Input } from '../../components/ui.jsx';

/* Небольшая витрина стикеров справа от формы (только на широких экранах) */
function AuthAside() {
  return (
    <aside className="auth-aside" aria-hidden="true">
      <div className="auth-aside__stickers">
        <span className="auth-sticker auth-sticker--lemon">Стикер</span>
        <span className="auth-sticker auth-sticker--cobalt">Брелок</span>
        <span className="auth-sticker auth-sticker--cherry">Чехол</span>
      </div>
      <p className="auth-aside__text">Ваши фото на стикерах, брелоках и чехлах. Печатаем в Душанбе.</p>
    </aside>
  );
}

function AuthShell({ title, lead, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-layout">
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-card__head">
            <h1 id="auth-title" className="auth-title">
              {title}
            </h1>
            {lead && <p className="auth-lead">{lead}</p>}
          </div>
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </section>
        <AuthAside />
      </div>
    </div>
  );
}

// Правила пароля из Program.cs (AddIdentity → options.Password)
const PASSWORD_HINT = 'Минимум 6 символов: заглавная и строчная буква, цифра и символ, например Stark#2026';
const passwordProblems = (p) =>
  [
    p.length < 6 && 'не короче 6 символов',
    !/[A-Z]/.test(p) && 'заглавная буква',
    !/[a-z]/.test(p) && 'строчная буква',
    !/\d/.test(p) && 'цифра',
    !/[^A-Za-zА-Яа-я0-9]/.test(p) && 'символ (#, !, @…)',
  ].filter(Boolean);

// Те же правила, что в passwordProblems, — показываем их живым чек-листом под полем
const PASSWORD_RULES = [
  ['не короче 6 символов', '6+ символов'],
  ['заглавная буква', 'Заглавная латинская'],
  ['строчная буква', 'Строчная латинская'],
  ['цифра', 'Цифра'],
  ['символ (#, !, @…)', 'Символ #!@'],
];

/** Чек-лист правил пароля. Показывается, когда пользователь начал вводить пароль. */
export function PasswordRules({ password, id }) {
  if (!password) return null;
  const missing = passwordProblems(password);
  return (
    <ul className="auth-rules" id={id} aria-label="Требования к паролю">
      {PASSWORD_RULES.map(([key, label]) => {
        const ok = !missing.includes(key);
        return (
          <li key={key} className={ok ? 'is-ok' : ''}>
            <span className="auth-rules__mark" aria-hidden="true" />
            {label}
            <span className="sr-only">{ok ? ' — выполнено' : ' — не выполнено'}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await login(email.trim(), password);
      const isStaff = s?.roles?.some((r) => r === 'Admin' || r === 'SuperAdmin');
      navigate(state?.from || (isStaff ? '/admin' : '/account'), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Вход"
      lead="Рады снова видеть! Войдите, чтобы следить за заказами и загружать фото."
      footer={
        <>
          <span>Нет аккаунта?</span>
          <Link to="/register" state={state} className="auth-switch">
            Зарегистрироваться
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="auth-form">
        <Input label="Email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="auth-form__pw">
          <Input
            label="Пароль"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link to="/forgot-password" className="auth-forgot">
            Забыли пароль?
          </Link>
        </div>
        <ErrorBox error={error} />
        <button className="btn btn--primary btn--block auth-submit" disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [form, setForm] = useState({ fullName: '', email: '', phoneNumber: '', password: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const problems = form.password ? passwordProblems(form.password) : [];
  const mismatch = form.confirmPassword && form.confirmPassword !== form.password;

  const submit = async (e) => {
    e.preventDefault();
    if (problems.length || mismatch) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.register(form);
      await login(form.email.trim(), form.password);
      navigate(state?.from || '/account', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Регистрация"
      lead="Минута — и можно загружать фото к заказам и следить за их статусом."
      footer={
        <>
          <span>Уже есть аккаунт?</span>
          <Link to="/login" state={state} className="auth-switch">
            Войти
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="auth-form">
        <Input label="Имя и фамилия" required maxLength={100} value={form.fullName} onChange={set('fullName')} autoComplete="name" />
        <Input label="Email" type="email" required inputMode="email" value={form.email} onChange={set('email')} autoComplete="email" />
        <Input
          label="Телефон"
          type="tel"
          required
          placeholder="+992 90 000 00 00"
          value={form.phoneNumber}
          onChange={set('phoneNumber')}
          autoComplete="tel"
        />
        <div className="auth-form__pw">
          <Input
            label="Пароль"
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            hint={form.password ? null : PASSWORD_HINT}
            aria-describedby={form.password ? 'reg-pw-rules' : undefined}
            aria-invalid={problems.length ? true : undefined}
          />
          <PasswordRules password={form.password} id="reg-pw-rules" />
        </div>
        <Input
          label="Повторите пароль"
          type="password"
          required
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={set('confirmPassword')}
          error={mismatch ? 'Пароли не совпадают' : null}
        />
        <ErrorBox error={error} />
        <button className="btn btn--primary btn--block auth-submit" disabled={busy}>
          {busy ? 'Создаём аккаунт…' : 'Создать аккаунт'}
        </button>
      </form>
    </AuthShell>
  );
}

const RESET_STEPS = [
  ['email', 'Email'],
  ['code', 'Код'],
  ['password', 'Новый пароль'],
];

export function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState({ newPassword: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const run = (fn) => async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const problems = pw.newPassword ? passwordProblems(pw.newPassword) : [];
  const stepIndex = RESET_STEPS.findIndex(([k]) => k === step);

  if (done) {
    return (
      <AuthShell title="Пароль изменён" lead="Готово! Теперь можно войти с новым паролем.">
        <button className="btn btn--primary btn--block auth-submit" onClick={() => navigate('/login')}>
          Войти
        </button>
      </AuthShell>
    );
  }

  const leads = {
    email: 'Введите email аккаунта — пришлём код для сброса пароля.',
    code: `Мы отправили код на ${email}. Проверьте почту и папку «Спам».`,
    password: 'Придумайте новый пароль.',
  };

  return (
    <AuthShell
      title="Восстановление пароля"
      lead={leads[step]}
      footer={
        <Link to="/login" className="auth-switch">
          Вернуться ко входу
        </Link>
      }
    >
      <ol className="auth-steps" aria-label="Шаги восстановления">
        {RESET_STEPS.map(([key, label], i) => (
          <li
            key={key}
            className={i === stepIndex ? 'is-active' : i < stepIndex ? 'is-done' : ''}
            aria-current={i === stepIndex ? 'step' : undefined}
          >
            <span className="auth-steps__num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="auth-steps__label">{label}</span>
          </li>
        ))}
      </ol>

      {step === 'email' && (
        <form className="auth-form" onSubmit={run(async () => { await authApi.sendResetCode(email.trim()); setStep('code'); })}>
          <Input label="Email аккаунта" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <ErrorBox error={error} />
          <button className="btn btn--primary btn--block auth-submit" disabled={busy}>
            {busy ? 'Отправляем…' : 'Отправить код'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form className="auth-form" onSubmit={run(async () => {
          const ok = await authApi.verifyResetCode(email.trim(), code.trim());
          if (ok === false) throw new Error('Неверный или просроченный код.');
          setStep('password');
        })}>
          <Input
            label="Код из письма"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            className="auth-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <ErrorBox error={error} />
          <button className="btn btn--primary btn--block auth-submit" disabled={busy}>
            {busy ? 'Проверяем…' : 'Проверить код'}
          </button>
        </form>
      )}

      {step === 'password' && (
        <form className="auth-form" onSubmit={run(async () => {
          if (problems.length) throw new Error(`Не хватает: ${problems.join(', ')}`);
          await authApi.resetPassword({ email: email.trim(), ...pw });
          setDone(true);
        })}>
          <div className="auth-form__pw">
            <Input
              label="Новый пароль"
              type="password"
              required
              autoComplete="new-password"
              hint={pw.newPassword ? null : PASSWORD_HINT}
              aria-describedby={pw.newPassword ? 'reset-pw-rules' : undefined}
              value={pw.newPassword}
              onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
            />
            <PasswordRules password={pw.newPassword} id="reset-pw-rules" />
          </div>
          <Input
            label="Повторите пароль"
            type="password"
            required
            autoComplete="new-password"
            value={pw.confirmPassword}
            onChange={(e) => setPw((p) => ({ ...p, confirmPassword: e.target.value }))}
            error={pw.confirmPassword && pw.confirmPassword !== pw.newPassword ? 'Пароли не совпадают' : null}
          />
          <ErrorBox error={error} />
          <button className="btn btn--primary btn--block auth-submit" disabled={busy}>
            {busy ? 'Сохраняем…' : 'Сохранить пароль'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export { passwordProblems, PASSWORD_HINT };
