import '../../styles/site/account.css';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from '../../lib/router.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { authApi } from '../../api/endpoints.js';
import { ErrorBox, Input } from '../../components/ui.jsx';
import { contactErrors } from '../../lib/validate.js';

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

// Правила пароля из Program.cs (AddIdentity → options.Password: RequiredLength = 8)
const PASSWORD_MIN = 8;
const PASSWORD_HINT = 'Минимум 8 символов: заглавная и строчная буква, цифра и символ, например Stark#2026';
const passwordProblems = (p) =>
  [
    p.length < PASSWORD_MIN && 'не короче 8 символов',
    // Identity проверяет char.IsUpper/IsLower/IsDigit/IsLetterOrDigit — буквы любого алфавита
    !/\p{Lu}/u.test(p) && 'заглавная буква',
    !/\p{Ll}/u.test(p) && 'строчная буква',
    !/\d/.test(p) && 'цифра',
    !/[^\p{L}\p{N}]/u.test(p) && 'символ (#, !, @…)',
  ].filter(Boolean);

// Те же правила, что в passwordProblems, — показываем их живым чек-листом под полем
const PASSWORD_RULES = [
  ['не короче 8 символов', '8+ символов'],
  ['заглавная буква', 'Заглавная буква'],
  ['строчная буква', 'Строчная буква'],
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

// Слишком много попыток: 429 от ограничителя частоты или блокировка аккаунта после неудачных входов.
const isTooMany = (err) => err?.status === 429 || (err?.messages ?? []).some((m) => /слишком много/i.test(m));
const COOLDOWN_SEC = 30;

/** Пауза после 429: кнопка отправки неактивна и показывает обратный отсчёт. */
function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, (err) => err?.status === 429 && setLeft(COOLDOWN_SEC)];
}

/** Ошибка формы входа/регистрации; для «слишком много попыток» — понятное пояснение и ссылка на сброс пароля. */
function AuthError({ error, withReset = false }) {
  if (!error) return null;
  if (!isTooMany(error)) return <ErrorBox error={error} />;
  return (
    <div className="error-box auth-limit" role="alert">
      {(error.messages ?? ['Слишком много попыток. Подождите немного и попробуйте снова.']).map((m, i) => (
        <p key={i}>{m}</p>
      ))}
      <p className="auth-limit__hint">
        Это защита от подбора пароля.{' '}
        {withReset && (
          <Link to="/forgot-password" className="auth-switch">
            Восстановить пароль
          </Link>
        )}
      </p>
    </div>
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
  const [cooldown, startCooldown] = useCooldown();

  const submit = async (e) => {
    e.preventDefault();
    if (cooldown > 0) return;
    setBusy(true);
    setError(null);
    try {
      const s = await login(email.trim(), password);
      const isStaff = s?.roles?.some((r) => r === 'Admin' || r === 'SuperAdmin');
      navigate(state?.from || (isStaff ? '/admin' : '/account'), { replace: true });
    } catch (err) {
      setError(err);
      startCooldown(err);
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
          <Link to="/forgot-password" state={state} className="auth-forgot">
            Забыли пароль?
          </Link>
        </div>
        <AuthError error={error} withReset />
        <button className="btn btn--primary btn--block auth-submit" disabled={busy || cooldown > 0}>
          {busy ? 'Входим…' : cooldown > 0 ? `Повторить через ${cooldown} с` : 'Войти'}
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
  const [cooldown, startCooldown] = useCooldown();
  // Аккаунт создан, но автоматический вход не удался — повторная регистрация не нужна, только вход.
  const [created, setCreated] = useState(false);
  // Согласие с офертой и политикой конфиденциальности — обязательно для регистрации.
  const [agree, setAgree] = useState(false);
  const [agreeError, setAgreeError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (cooldown > 0) return;
    if (!agree) {
      setAgreeError('Чтобы создать аккаунт, примите условия оферты и политики конфиденциальности.');
      document.getElementById('reg-consent')?.focus();
      return;
    }
    const invalid = contactErrors(form.fullName, form.phoneNumber);
    if (invalid) return setError(invalid);
    if (problems.length) return setError({ messages: [`Пароль: не хватает — ${problems.join(', ')}.`] });
    if (form.password !== form.confirmPassword) return setError({ messages: ['Пароли не совпадают.'] });
    setBusy(true);
    setError(null);
    try {
      await authApi.register(form);
    } catch (err) {
      setError(err);
      startCooldown(err);
      setBusy(false);
      return;
    }
    try {
      await login(form.email.trim(), form.password);
      navigate(state?.from || '/account', { replace: true });
    } catch {
      setCreated(true);
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <AuthShell title="Аккаунт создан" lead="Аккаунт создан, но войти автоматически не получилось. Войдите с вашим email и паролем.">
        <Link to="/login" state={state} className="btn btn--primary btn--block auth-submit">
          Войти
        </Link>
      </AuthShell>
    );
  }

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
          inputMode="tel"
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
        <div className={`field auth-consent${agreeError ? ' field--error' : ''}`}>
          <label className="checkbox auth-consent__label" htmlFor="reg-consent">
            <input
              id="reg-consent"
              type="checkbox"
              checked={agree}
              onChange={(e) => {
                setAgree(e.target.checked);
                if (e.target.checked) setAgreeError(null);
              }}
              aria-invalid={agreeError ? true : undefined}
              aria-describedby={agreeError ? 'reg-consent-error' : undefined}
            />
            <span>
              Я принимаю условия{' '}
              <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-link">
                Публичной оферты<span className="sr-only"> (откроется в новой вкладке)</span>
              </Link>{' '}
              и{' '}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-link">
                Политики конфиденциальности<span className="sr-only"> (откроется в новой вкладке)</span>
              </Link>
            </span>
          </label>
          {agreeError && (
            <p className="field__error" id="reg-consent-error" role="alert">
              {agreeError}
            </p>
          )}
        </div>
        <AuthError error={error} />
        <button className="btn btn--primary btn--block auth-submit" disabled={busy || cooldown > 0}>
          {busy ? 'Создаём аккаунт…' : cooldown > 0 ? `Повторить через ${cooldown} с` : 'Создать аккаунт'}
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
  // Откуда пришли на вход (state.from) — передаём дальше, чтобы после входа вернуться туда же.
  const { state } = useLocation();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [pw, setPw] = useState({ newPassword: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Сообщение «код отправлен повторно» на шаге ввода кода
  const [resent, setResent] = useState(false);

  // Повторная отправка кода тем же запросом, что и на первом шаге
  const resend = async () => {
    setBusy(true);
    setError(null);
    setResent(false);
    try {
      await authApi.sendResetCode(email.trim());
      setCode('');
      setResent(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const changeEmail = () => {
    setError(null);
    setResent(false);
    setCode('');
    setResetToken('');
    setStep('email');
  };

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
        <button className="btn btn--primary btn--block auth-submit" onClick={() => navigate('/login', { state })}>
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
        <Link to="/login" state={state} className="auth-switch">
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
          <AuthError error={error} />
          <button className="btn btn--primary btn--block auth-submit" disabled={busy}>
            {busy ? 'Отправляем…' : 'Отправить код'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form className="auth-form" onSubmit={run(async () => {
          // Сервер возвращает одноразовый resetToken — без него сброс пароля не пройдёт.
          const res = await authApi.verifyResetCode(email.trim(), code.trim());
          const token = res?.resetToken;
          if (res === false || !token) throw new Error('Неверный или просроченный код.');
          setResetToken(token);
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
          {resent && (
            <p className="auth-resent" role="status">
              Новый код отправлен на {email}. Предыдущий код больше не подойдёт.
            </p>
          )}
          <AuthError error={error} />
          <button className="btn btn--primary btn--block auth-submit" disabled={busy}>
            {busy ? 'Проверяем…' : 'Проверить код'}
          </button>
          <div className="auth-alt">
            <button type="button" className="auth-alt__btn" onClick={resend} disabled={busy}>
              Отправить код ещё раз
            </button>
            <button type="button" className="auth-alt__btn" onClick={changeEmail} disabled={busy}>
              Изменить email
            </button>
          </div>
        </form>
      )}

      {step === 'password' && (
        <form className="auth-form" onSubmit={run(async () => {
          if (problems.length) throw new Error(`Не хватает: ${problems.join(', ')}`);
          if (pw.newPassword !== pw.confirmPassword) throw new Error('Пароли не совпадают.');
          await authApi.resetPassword({ email: email.trim(), resetToken, ...pw });
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
          <AuthError error={error} />
          <button className="btn btn--primary btn--block auth-submit" disabled={busy}>
            {busy ? 'Сохраняем…' : 'Сохранить пароль'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export { passwordProblems, PASSWORD_HINT };
