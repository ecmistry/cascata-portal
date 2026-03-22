import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

type View = "login" | "register" | "forgot";

export default function Login() {
  const [, setLocation] = useLocation();
  const [view, setView] = useState<View>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (err) => {
      setError(err.message || "Login failed");
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      window.location.href = "/setup";
    },
    onError: (err) => {
      setError(err.message || "Registration failed");
    },
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError("Please enter both email and password"); return; }
    try { await loginMutation.mutateAsync({ email, password }); } catch {}
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Please enter your name"); return; }
    if (!email.trim()) { setError("Please enter your email"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (!companyName.trim()) { setError("Please enter your company name"); return; }
    try { await registerMutation.mutateAsync({ name: name.trim(), email: email.trim(), password, companyName: companyName.trim() }); } catch {}
  };

  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError("Please enter your email address"); return; }
    setForgotSent(true);
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;

  const switchView = (v: View) => {
    setView(v);
    setError(null);
    setForgotSent(false);
  };

  const inputStyle: React.CSSProperties = {
    height: '44px', padding: '0 12px', border: '1px solid #CCC',
    borderRadius: '6px', fontSize: '14px', outline: 'none',
    transition: 'border-color 0.2s', width: '100%',
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = '#2196F3'; };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = '#CCC'; };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: '#EAF5FF',
        backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(33, 150, 243, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(76, 175, 80, 0.1) 0%, transparent 50%)',
      }}
    >
      <div
        className="w-full"
        style={{
          maxWidth: '440px', backgroundColor: '#FFFFFF', borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)', padding: '40px',
        }}
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}>
              <img src="/logo.png" alt="Cascata Logo" style={{ width: '54px', height: '54px', objectFit: 'contain' }} />
            </div>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#333333', marginBottom: '4px' }}>Cascata</h1>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Revenue Forecasting Platform</p>
        </div>

        {/* ---- LOGIN VIEW ---- */}
        {view === "login" && (
          <>
            <div className="text-center mb-5">
              <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>Welcome Back</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Sign in to your account</p>
            </div>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="email" style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>Email</label>
                <input id="email" type="text" placeholder="your.email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isPending} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="password" style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>Password</label>
                <input id="password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isPending} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              {error && <div style={{ fontSize: '13px', color: '#DC2626', backgroundColor: '#FEE2E2', padding: '10px 12px', borderRadius: '6px', border: '1px solid #FECACA' }}>{error}</div>}
              <button type="submit" disabled={isPending} style={{ width: '100%', height: '44px', backgroundColor: '#2196F3', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: '600', cursor: isPending ? 'not-allowed' : 'pointer', boxShadow: '0 4px 10px rgba(33,150,243,0.4)', opacity: isPending ? 0.7 : 1 }}>
                {isPending ? "Signing in..." : "Sign In"}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <button type="button" onClick={() => switchView("forgot")} style={{ fontSize: '13px', color: '#2196F3', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Forgot Password?</button>
                <button type="button" onClick={() => switchView("register")} style={{ fontSize: '13px', color: '#2196F3', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Create Account</button>
              </div>
            </form>
          </>
        )}

        {/* ---- REGISTER VIEW ---- */}
        {view === "register" && (
          <>
            <div className="text-center mb-5">
              <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>Create Your Account</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Get started with Cascata in minutes</p>
            </div>
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>Your Name</label>
                <input type="text" placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} disabled={isPending} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>Work Email</label>
                <input type="email" placeholder="jane@company.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isPending} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>Company Name</label>
                <input type="text" placeholder="Acme Corporation" value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={isPending} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>Password</label>
                  <input type="password" placeholder="Min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isPending} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>Confirm</label>
                  <input type="password" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isPending} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
              </div>
              {error && <div style={{ fontSize: '13px', color: '#DC2626', backgroundColor: '#FEE2E2', padding: '10px 12px', borderRadius: '6px', border: '1px solid #FECACA' }}>{error}</div>}
              <button type="submit" disabled={isPending} style={{ width: '100%', height: '44px', backgroundColor: '#2196F3', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: '600', cursor: isPending ? 'not-allowed' : 'pointer', boxShadow: '0 4px 10px rgba(33,150,243,0.4)', opacity: isPending ? 0.7 : 1 }}>
                {isPending ? "Creating Account..." : "Create Account & Get Started"}
              </button>
              <div className="text-center" style={{ marginTop: '4px' }}>
                <button type="button" onClick={() => switchView("login")} style={{ fontSize: '13px', color: '#2196F3', background: 'none', border: 'none', cursor: 'pointer' }}>Already have an account? Sign in</button>
              </div>
            </form>
          </>
        )}

        {/* ---- FORGOT PASSWORD VIEW ---- */}
        {view === "forgot" && (
          <>
            <div className="text-center mb-5">
              <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>Reset Password</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>We'll send you instructions to reset your password</p>
            </div>
            {forgotSent ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <p style={{ fontSize: '14px', color: '#333', marginBottom: '8px', fontWeight: '500' }}>Check your inbox</p>
                <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>If an account exists for <strong>{email}</strong>, you'll receive reset instructions shortly. If you don't receive an email, please contact your administrator.</p>
                <button type="button" onClick={() => switchView("login")} style={{ fontSize: '13px', color: '#2196F3', background: 'none', border: 'none', cursor: 'pointer' }}>Back to Sign In</button>
              </div>
            ) : (
              <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>Email Address</label>
                  <input type="email" placeholder="your.email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                {error && <div style={{ fontSize: '13px', color: '#DC2626', backgroundColor: '#FEE2E2', padding: '10px 12px', borderRadius: '6px', border: '1px solid #FECACA' }}>{error}</div>}
                <button type="submit" style={{ width: '100%', height: '44px', backgroundColor: '#2196F3', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 10px rgba(33,150,243,0.4)' }}>
                  Send Reset Instructions
                </button>
                <div className="text-center" style={{ marginTop: '4px' }}>
                  <button type="button" onClick={() => switchView("login")} style={{ fontSize: '13px', color: '#2196F3', background: 'none', border: 'none', cursor: 'pointer' }}>Back to Sign In</button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
