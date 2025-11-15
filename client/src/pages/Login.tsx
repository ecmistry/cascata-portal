import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      // Refresh the auth state and redirect to dashboard (home page)
      window.location.href = "/";
    },
    onError: (err) => {
      setError(err.message || "Login failed");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    try {
      await loginMutation.mutateAsync({ email, password });
    } catch (err) {
      // Error is handled in onError
    }
  };

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
          maxWidth: '400px',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
          padding: '40px',
        }}
      >
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div 
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              }}
            >
              <img 
                src="/logo.png" 
                alt="Cascata Logo" 
                style={{
                  width: '60px',
                  height: '60px',
                  objectFit: 'contain',
                }}
              />
            </div>
          </div>
          <h1 
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#333333',
              marginBottom: '8px',
            }}
          >
            Cascata
          </h1>
          <p 
            style={{
              fontSize: '14px',
              color: '#6B7280',
              margin: 0,
            }}
          >
            Transform Forecasting
          </p>
        </div>

        {/* Welcome Message */}
        <div className="text-center mb-6">
          <h2 
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#333333',
              marginBottom: '8px',
            }}
          >
            Welcome Back
          </h2>
          <p 
            style={{
              fontSize: '14px',
              color: '#6B7280',
              margin: 0,
            }}
          >
            Sign in to your account to continue
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label 
              htmlFor="email" 
              style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#333333',
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="text"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loginMutation.isPending}
              style={{
                height: '44px',
                padding: '0 12px',
                border: '1px solid #CCC',
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2196F3';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#CCC';
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label 
              htmlFor="password" 
              style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#333333',
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loginMutation.isPending}
              style={{
                height: '44px',
                padding: '0 12px',
                border: '1px solid #CCC',
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2196F3';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#CCC';
              }}
            />
          </div>

          {error && (
            <div 
              style={{
                fontSize: '14px',
                color: '#DC2626',
                backgroundColor: '#FEE2E2',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #FECACA',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            style={{
              width: '100%',
              height: '44px',
              backgroundColor: '#2196F3',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loginMutation.isPending ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 10px rgba(33, 150, 243, 0.4)',
              transition: 'background-color 0.2s, box-shadow 0.2s',
              opacity: loginMutation.isPending ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loginMutation.isPending) {
                e.currentTarget.style.backgroundColor = '#1976D2';
              }
            }}
            onMouseLeave={(e) => {
              if (!loginMutation.isPending) {
                e.currentTarget.style.backgroundColor = '#2196F3';
              }
            }}
          >
            {loginMutation.isPending ? "Logging in..." : "Sign In"}
          </button>

          {/* Footer Links */}
          <div 
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '8px',
            }}
          >
            {/* Forgot Password and Create Account features coming soon */}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert('Password reset feature coming soon. Please contact your administrator.');
              }}
              style={{
                fontSize: '14px',
                color: '#2196F3',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              Forgot Password?
            </a>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert('Account creation feature coming soon. Please contact your administrator.');
              }}
              style={{
                fontSize: '14px',
                color: '#2196F3',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              Create Account
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

