import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { Brand, Toast } from "../components/shared/Brand";
import "../components/shared/dm.css";
import { ApiError, login, signup as signupRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export function Auth() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [signup, setSignup] = useState(false);
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = signup
        ? await signupRequest({ full_name: fullName, email, password })
        : await login({ email, password });
      setUser(data.user);
      setToast(signup ? "Workspace created — welcome to DocuMind." : "Signed in — loading your workspace.");
      navigate("/dashboard");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      setToast(message);
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="dm-root dm-noise relative flex min-h-[100dvh] items-center justify-center overflow-hidden p-5 md:p-10">
    <div className="dm-grid pointer-events-none absolute inset-0 opacity-50" /><div className="pointer-events-none absolute left-[12%] top-[15%] h-80 w-80 rounded-full bg-[#39ca72]/10 blur-[100px]" /><div className="pointer-events-none absolute bottom-[5%] right-[5%] h-72 w-72 rounded-full bg-[#d9b66d]/[.06] blur-[110px]" />
    <div className="relative z-10 grid w-full max-w-[1030px] overflow-hidden rounded-[28px] border border-[#c7dcc9]/15 bg-[#0c130e]/85 shadow-[0_40px_120px_rgba(0,0,0,.45)] backdrop-blur-2xl lg:grid-cols-[.86fr_1.14fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-[#c7dcc9]/10 bg-[#101d14] p-10 lg:flex"><div className="absolute -right-20 top-20 h-80 w-80 rounded-full border border-[#9df4b1]/10 bg-[#39ca72]/[.05] shadow-[0_0_100px_rgba(57,202,114,.1)]" /><div className="absolute -right-8 top-32 h-56 w-56 rounded-full border border-[#9df4b1]/10" /><div className="relative"><Brand/><div className="mt-28"><span className="dm-mono text-[10px] uppercase tracking-[.2em] text-[#d9b66d]">A clearer back office</span><h1 className="dm-display mt-5 text-5xl font-medium leading-[.98] tracking-[-.07em]">Good data<br/>makes room<br/><em className="font-normal text-[#9df4b1]">for good work.</em></h1><p className="mt-7 max-w-[270px] text-[12px] leading-6 text-[#95a69a]">A trusted AI workspace for the documents your business runs on.</p></div></div><div className="relative flex items-center gap-3 border-t border-[#c7dcc9]/10 pt-5 text-[10px] text-[#617167]"><ShieldCheck size={15} className="text-[#9df4b1]"/> SOC 2-ready controls <span className="mx-1 h-1 w-1 rounded-full bg-[#d9b66d]"/> Built for finance teams</div></div>
      <div className="p-7 sm:p-10 md:p-14"><div className="mb-10 flex items-center justify-between lg:justify-end"><div className="lg:hidden"><Brand/></div><span className="text-[11px] text-[#617167]">{signup ? "Already have an account?" : "New to DocuMind?"} <button onClick={()=>setSignup(!signup)} className="ml-1 font-bold text-[#9df4b1] hover:text-[#c0ffd0]">{signup?"Sign in":"Create account"}</button></span></div><div className="mx-auto max-w-[380px]"><button onClick={()=>setToast("Google sign-in is not available yet.")} className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#c7dcc9]/15 bg-[#f2f4ee] py-3.5 text-[12px] font-bold text-[#162118] transition hover:bg-[#fff]"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#162118]/20 text-[11px] font-bold">G</span> Continue with Google</button><div className="my-7 flex items-center gap-3 text-[9px] uppercase tracking-[.15em] text-[#617167]"><span className="h-px flex-1 bg-[#c7dcc9]/10"/><span>or use email</span><span className="h-px flex-1 bg-[#c7dcc9]/10"/></div><h2 className="dm-display text-3xl font-medium tracking-[-.06em]">{signup?"Create your workspace":"Welcome back"}</h2><p className="mt-2 text-[12px] text-[#95a69a]">{signup?"Start turning documents into decisions.":"Your documents are waiting for a little clarity."}</p><form onSubmit={submit} className="mt-8 space-y-4">{signup&&<label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#95a69a]">Full name</span><input value={fullName} onChange={e=>setFullName(e.target.value)} className="dm-input !rounded-xl !border-[#c7dcc9]/15 !bg-[#101912] !py-3.5" placeholder="Maya Chen" required /></label>}<label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#95a69a]">Work email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="dm-input !rounded-xl !border-[#c7dcc9]/15 !bg-[#101912] !py-3.5" placeholder="you@company.com" required /></label><label className="block"><div className="mb-2 flex justify-between"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#95a69a]">Password</span>{!signup&&<button type="button" onClick={()=>setToast("Password reset is not available yet.")} className="text-[10px] text-[#9df4b1]">Forgot password?</button>}</div><div className="relative"><input type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} className="dm-input !rounded-xl !border-[#c7dcc9]/15 !bg-[#101912] !py-3.5 !pr-11" placeholder={signup?"At least 8 characters":"••••••••••"} minLength={8} required /><button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#617167] hover:text-[#e8f0e5]">{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label><button disabled={submitting} className="dm-btn dm-btn-primary mt-3 w-full !rounded-xl !py-3.5 disabled:opacity-60">{submitting ? "Please wait…" : signup?"Create workspace":"Sign in"} <ArrowRight size={15}/></button></form><div className="mt-8 flex items-start gap-2 text-[10px] leading-4 text-[#617167]"><LockKeyhole size={13} className="mt-0.5 shrink-0 text-[#d9b66d]"/>{signup?"By continuing, you agree to DocuMind's Terms and Privacy Policy.":"Your data is encrypted in transit and at rest. We never train on your documents."}</div></div><button onClick={()=>navigate("/")} className="mt-12 flex items-center gap-2 text-[11px] text-[#617167] hover:text-[#e8f0e5]"><ArrowLeft size={14}/> Back to DocuMind</button></div>
    </div>{toast&&<Toast message={toast} onClose={()=>setToast("")}/>}
  </main>;
}