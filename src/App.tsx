import { type ReactNode, useCallback, useEffect, useState } from "react";
import "./App.css";
import { ForgotPassword } from "./pages/auth/ForgotPassword";
import { Login } from "./pages/auth/Login";
import { Register } from "./pages/auth/Register";
import { ResetPassword } from "./pages/auth/ResetPassword";
import { Home } from "./pages/home/Home";
import { ChangePassword } from "./pages/profile/ChangePassword";
import { Profile } from "./pages/profile/Profile";
import { ManageSurveys } from "./pages/survey/ManageSurveys";

type AuthPage =
  | "change-password"
  | "forgot-password"
  | "home"
  | "login"
  | "manage-surveys"
  | "profile"
  | "register"
  | "reset-password";

const AUTH_SESSION_KEY = "survey_auth_session";
const AUTH_TOKEN_KEY = "survey_auth_token";
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://survey-general-api.test"
).replace(/\/$/, "");

type AccountProfile = {
  full_name?: string | null;
  username?: string | null;
};

type ProfileApiResult = {
  data?: AccountProfile;
};

const PAGE_PATHS: Record<AuthPage, string> = {
  "change-password": "/profile/change-password",
  "forgot-password": "/forgot-password",
  home: "/",
  login: "/login",
  "manage-surveys": "/surveys/manage",
  profile: "/profile",
  register: "/register",
  "reset-password": "/reset-password",
};

const hasStoredAuth = () =>
  Boolean(
    localStorage.getItem(AUTH_SESSION_KEY) ||
      sessionStorage.getItem(AUTH_SESSION_KEY) ||
      localStorage.getItem(AUTH_TOKEN_KEY) ||
      sessionStorage.getItem(AUTH_TOKEN_KEY),
  );

const getStoredToken = () =>
  localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);

const authHeaders = (): HeadersInit => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getResetToken = () => {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("reset_token") ?? searchParams.get("token");
};

const getInitialAuthPage = (): AuthPage => {
  if (getResetToken()) {
    return "reset-password";
  }

  const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";

  if (
    (normalizedPath === PAGE_PATHS.profile ||
      normalizedPath === PAGE_PATHS["change-password"] ||
      normalizedPath === PAGE_PATHS["manage-surveys"]) &&
    !hasStoredAuth()
  ) {
    return "login";
  }

  if (normalizedPath === PAGE_PATHS.profile) {
    return "profile";
  }

  if (normalizedPath === PAGE_PATHS["change-password"]) {
    return "change-password";
  }

  if (normalizedPath === PAGE_PATHS["manage-surveys"]) {
    return "manage-surveys";
  }

  if (normalizedPath === PAGE_PATHS.login) {
    return "login";
  }

  if (normalizedPath === PAGE_PATHS.register) {
    return "register";
  }

  if (normalizedPath === PAGE_PATHS["forgot-password"]) {
    return "forgot-password";
  }

  if (normalizedPath === PAGE_PATHS["reset-password"]) {
    return "reset-password";
  }

  return "home";
};

const syncUrl = (page: AuthPage, replace = false) => {
  const url = new URL(window.location.href);
  url.pathname = PAGE_PATHS[page];

  if (page !== "reset-password") {
    url.searchParams.delete("reset_token");
    url.searchParams.delete("token");
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl === currentUrl) {
    return;
  }

  if (replace) {
    window.history.replaceState({}, "", nextUrl);
    return;
  }

  window.history.pushState({}, "", nextUrl);
};

const clearResetTokenFromUrl = (page: AuthPage = getInitialAuthPage()) => {
  const url = new URL(window.location.href);
  url.pathname = PAGE_PATHS[page];
  url.searchParams.delete("reset_token");
  url.searchParams.delete("token");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasStoredAuth());
  const [resetToken, setResetToken] = useState<string | null>(() => getResetToken());
  const [authPage, setAuthPage] = useState<AuthPage>(() => getInitialAuthPage());
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(
    null,
  );
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    syncUrl(authPage, true);

    const handlePopState = () => {
      const nextResetToken = getResetToken();
      setResetToken(nextResetToken);
      setAuthPage(getInitialAuthPage());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [authPage]);

  const navigate = useCallback((page: AuthPage, replace = false) => {
    if (page !== "reset-password") {
      setResetToken(null);
    }

    setAuthPage(page);
    syncUrl(page, replace);
  }, []);

  const loadAccountProfile = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        credentials: "include",
        headers: authHeaders(),
        method: "GET",
      });

      if (!response.ok) {
        return;
      }

      const result = (await response.json()) as ProfileApiResult;
      setAccountProfile(result.data ?? null);
    } catch {
      setAccountProfile(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void loadAccountProfile();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [isAuthenticated, loadAccountProfile]);

  const goToLogin = useCallback(() => {
    clearResetTokenFromUrl("login");
    setResetToken(null);
    navigate("login", true);
  }, [navigate]);

  const clearAuthSession = useCallback(() => {
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    setAccountProfile(null);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        credentials: "include",
        headers: authHeaders(),
        method: "POST",
      });
    } finally {
      setIsLogoutConfirmOpen(false);
      clearAuthSession();
      setIsAuthenticated(false);
      navigate("home", true);
    }
  }, [clearAuthSession, navigate]);

  const handleAuthAction = useCallback(() => {
    if (isAuthenticated) {
      setIsLogoutConfirmOpen(true);
      return;
    }

    goToLogin();
  }, [goToLogin, isAuthenticated]);

  const handleAuthenticated = useCallback(() => {
    setIsAuthenticated(true);
    navigate("home", true);
  }, [navigate]);

  const handleUnauthorized = useCallback(() => {
    setIsLogoutConfirmOpen(false);
    clearAuthSession();
    setIsAuthenticated(false);
    goToLogin();
  }, [clearAuthSession, goToLogin]);

  const openHome = useCallback(() => {
    navigate("home");
  }, [navigate]);

  const openProfile = useCallback(() => {
    if (isAuthenticated) {
      navigate("profile");
      return;
    }

    goToLogin();
  }, [goToLogin, isAuthenticated, navigate]);

  const openChangePassword = useCallback(() => {
    if (isAuthenticated) {
      navigate("change-password");
      return;
    }

    goToLogin();
  }, [goToLogin, isAuthenticated, navigate]);

  const openManageSurveys = useCallback(() => {
    if (isAuthenticated) {
      navigate("manage-surveys");
      return;
    }

    goToLogin();
  }, [goToLogin, isAuthenticated, navigate]);

  const openForgotPassword = useCallback(() => {
    navigate("forgot-password");
  }, [navigate]);

  const openRegister = useCallback(() => {
    navigate("register");
  }, [navigate]);

  const accountName = accountProfile?.full_name?.trim() || "Pengguna";
  const accountDescription = accountProfile?.username?.trim() || "Belum login";

  const renderLogoutDialog = () => {
    if (!isLogoutConfirmOpen) {
      return null;
    }

    return (
      <div className="app-logout-dialog" role="presentation">
        <button
          aria-label="Batalkan logout"
          className="app-logout-dialog__backdrop"
          onClick={() => setIsLogoutConfirmOpen(false)}
          type="button"
        />
        <section
          aria-labelledby="logout-dialog-title"
          aria-modal="true"
          className="app-logout-dialog__panel"
          role="dialog"
        >
          <h2 id="logout-dialog-title">Keluar dari akun?</h2>
          <p>
            Sesi login akan ditutup dan token akses akan dilepas dari perangkat
            ini.
          </p>
          <div className="app-logout-dialog__actions">
            <button onClick={() => setIsLogoutConfirmOpen(false)} type="button">
              Batal
            </button>
            <button onClick={() => void handleLogout()} type="button">
              Logout
            </button>
          </div>
        </section>
      </div>
    );
  };

  const withLogoutDialog = (content: ReactNode) => (
    <>
      {content}
      {renderLogoutDialog()}
    </>
  );

  if (authPage === "home") {
    return withLogoutDialog(
      <Home
        accountDescription={accountDescription}
        accountName={accountName}
        isAuthenticated={isAuthenticated}
        onAuthAction={handleAuthAction}
        onOpenManageSurveys={openManageSurveys}
        onOpenProfile={openProfile}
      />,
    );
  }

  if (authPage === "profile") {
    return withLogoutDialog(
      <Profile
        accountDescription={accountDescription}
        accountName={accountName}
        isAuthenticated={isAuthenticated}
        onAuthAction={handleAuthAction}
        onBackHome={openHome}
        onOpenChangePassword={openChangePassword}
        onOpenManageSurveys={openManageSurveys}
        onProfileLoaded={setAccountProfile}
        onUnauthorized={handleUnauthorized}
      />,
    );
  }

  if (authPage === "manage-surveys") {
    return withLogoutDialog(
      <ManageSurveys
        accountDescription={accountDescription}
        accountName={accountName}
        isAuthenticated={isAuthenticated}
        onAuthAction={handleAuthAction}
        onBackHome={openHome}
        onOpenProfile={openProfile}
        onUnauthorized={handleUnauthorized}
      />,
    );
  }

  if (authPage === "change-password") {
    return withLogoutDialog(
      <ChangePassword
        onBackToProfile={openProfile}
        onChangeSuccess={openProfile}
        onUnauthorized={handleUnauthorized}
      />,
    );
  }

  if (authPage === "forgot-password") {
    return withLogoutDialog(<ForgotPassword onBackToLogin={goToLogin} />);
  }

  if (authPage === "reset-password") {
    return withLogoutDialog(
      <ResetPassword
        onBackToLogin={goToLogin}
        onResetSuccess={goToLogin}
        token={resetToken}
      />,
    );
  }

  return withLogoutDialog(
    <>
      {authPage === "login" ? (
        <Login
          onForgotPassword={openForgotPassword}
          onLoginSuccess={handleAuthenticated}
          onSwitchToRegister={openRegister}
        />
      ) : (
        <Register
          onRegisterSuccess={handleAuthenticated}
          onSwitchToLogin={goToLogin}
        />
      )}
    </>,
  );
}

export default App;
