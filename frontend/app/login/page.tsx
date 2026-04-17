"use client";

export default function LoginPage() {
  const handleGoogleLogin = () => {
    // Redirect to backend login endpoint
    window.location.href = "http://localhost:8000/api/v1/auth/google/login";
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mx-auto shadow-lg shadow-blue-200">
            P
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mt-4">
            Welcome Back
          </h1>
          <p className="text-gray-500">
            Sign in to access your document pipeline
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border border-gray-200 rounded-2xl font-semibold text-gray-700 hover:bg-gray-50 hover:shadow-md transition-all active:scale-[0.98]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>


        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-100"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-400 font-medium">Trusted by teams everywhere</span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-gray-400 text-sm">
            By signing in, you agree to our Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
