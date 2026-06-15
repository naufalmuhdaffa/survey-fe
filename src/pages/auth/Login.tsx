import { type FormEvent, useState } from "react";
import brandIcon from "../../assets/auth/login/login-brand-icon.svg";
import eyeIcon from "../../assets/auth/login/login-eye-icon.svg";
import floatingIcon from "../../assets/auth/login/login-floating-icon.svg";
import nikIcon from "../../assets/auth/login/login-nik-icon.svg";
import passwordIcon from "../../assets/auth/login/login-password-icon.svg";
import "../../styles/auth/Login.scss";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://survey-general-api.test"
).replace(/\/$/, "");

const AUTH_SESSION_KEY = "survey_auth_session";
const AUTH_TOKEN_KEY = "survey_auth_token";

type LoginProps = {
  onForgotPassword?: () => void;
  onLoginSuccess?: () => void;
  onSwitchToRegister?: () => void;
};

type ApiResult = {
  data?: {
    access_token?: string;
    token?: string;
  };
  access_token?: string;
  message?: string;
  token?: string;
};

const getApiMessage = async (response: Response) => {
  try {
    const result = (await response.json()) as ApiResult;
    return result.message ?? "Terjadi kesalahan pada server.";
  } catch {
    return "Terjadi kesalahan pada server.";
  }
};

const getToken = (result: ApiResult) =>
  result.token ?? result.access_token ?? result.data?.token ?? result.data?.access_token;

const persistAuthSession = (result: ApiResult, rememberMe: boolean) => {
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);

  const storage = rememberMe ? localStorage : sessionStorage;
  const token = getToken(result);

  if (!token) {
    throw new Error("Token login tidak diterima dari server.");
  }

  storage.setItem(AUTH_SESSION_KEY, "1");
  storage.setItem(AUTH_TOKEN_KEY, token);
};

export const Login = ({
  onForgotPassword,
  onLoginSuccess,
  onSwitchToRegister,
}: LoginProps) => {
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const trimmedIdentity = identity.trim();

    if (!trimmedIdentity || !password.trim()) {
      setFeedback({
        message: "NIK/username dan kata sandi wajib diisi.",
        type: "error",
      });
      return;
    }

    const payload = /^\d{16}$/.test(trimmedIdentity)
      ? { nik: trimmedIdentity, password }
      : { username: trimmedIdentity, password };

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        body: JSON.stringify(payload),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await getApiMessage(response));
      }

      const result = (await response.json()) as ApiResult;
      persistAuthSession(result, rememberMe);

      setFeedback({
        message: result.message ?? "Login berhasil.",
        type: "success",
      });
      onLoginSuccess?.();
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "Login gagal. Silakan coba lagi.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel__inner">
          <div className="login-brand">
            <span className="login-brand__mark" aria-hidden="true">
              <img src={brandIcon} alt="" />
            </span>
            <strong>Survey PemKot Jogja</strong>
          </div>

          <header className="login-header">
            <h1 id="login-title">Selamat Datang</h1>
            <p>
              Silakan masuk menggunakan NIK dan kata sandi Anda untuk mengakses
              portal layanan.
            </p>
          </header>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="login-identity">Username / NIK</label>
              <div className="login-field__control">
                <img src={nikIcon} alt="" aria-hidden="true" />
                <input
                  autoComplete="username"
                  id="login-identity"
                  name="identity"
                  onChange={(event) => setIdentity(event.target.value)}
                  placeholder="Masukkan 16 digit NIK"
                  type="text"
                  value={identity}
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Kata Sandi</label>
              <div className="login-field__control">
                <img src={passwordIcon} alt="" aria-hidden="true" />
                <input
                  autoComplete="current-password"
                  id="login-password"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={
                    showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
                  }
                  className="login-field__toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  <img src={eyeIcon} alt="" />
                </button>
              </div>
            </div>

            <div className="login-options">
              <label htmlFor="remember-me">
                <input
                  checked={rememberMe}
                  id="remember-me"
                  onChange={(event) => setRememberMe(event.target.checked)}
                  type="checkbox"
                />
                <span>Ingat Saya</span>
              </label>
              <button onClick={onForgotPassword} type="button">
                Lupa Kata Sandi?
              </button>
            </div>

            {feedback && (
              <p className={`login-feedback login-feedback--${feedback.type}`}>
                {feedback.message}
              </p>
            )}

            <button className="login-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Memproses..." : "Masuk"}
            </button>
          </form>

          <p className="login-register-link">
            Belum memiliki akun?{" "}
            <button onClick={onSwitchToRegister} type="button">
              Daftar disini
            </button>
          </p>

          <footer className="login-footer">
            &copy; 2026 Pemerintah Daerah Istimewa Yogyakarta.
          </footer>
        </div>
      </section>

      <aside className="login-visual" aria-label="Partisipasi publik">
        <div className="login-visual__overlay" />
        <div className="login-visual__gradient" />
        <div className="login-highlight">
          <img src={floatingIcon} alt="" aria-hidden="true" />
          <div>
            <h2>Partisipasi Publik Terintegrasi</h2>
            <p>
              Membangun Yogyakarta yang lebih baik melalui pengambilan keputusan
              berbasis data dan masukan langsung dari masyarakat.
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
};
