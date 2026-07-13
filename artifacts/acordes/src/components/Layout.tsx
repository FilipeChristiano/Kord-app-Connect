import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Music, BookOpen, Heart, Menu, X, Lightbulb, Wand2, LogOut, Timer, Waves, AudioWaveform, CreditCard, Sun, Moon } from "lucide-react";
import { useClerk } from "@clerk/react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/hooks/use-favorites";
import { useCifrasFavoritas } from "@/hooks/use-cifras-favoritas";
import { useAccess } from "@/hooks/use-access";
import { isIosApp } from "@/lib/native-app";
import { motion, AnimatePresence } from "framer-motion";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function ThemeToggle({ variant }: { variant: "desktop" | "mobile" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isLight = mounted && resolvedTheme === "light";
  const label = isLight ? "Tema escuro" : "Tema claro";
  const Icon = isLight ? Moon : Sun;

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={() => setTheme(isLight ? "dark" : "light")}
        className="flex items-center gap-3 px-4 py-4 rounded-xl text-base font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all w-full text-left"
      >
        <Icon className="w-5 h-5" />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-sans font-medium whitespace-nowrap text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
      title={label}
      aria-label={label}
    >
      <Icon className="w-4 h-4 opacity-70" />
    </button>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { favoritesCount } = useFavorites();
  const { cifrasCount } = useCifrasFavoritas();
  const totalFavoritos = favoritesCount + cifrasCount;
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signOut } = useClerk();
  const { data: access } = useAccess();
  const [openingPortal, setOpeningPortal] = useState(false);
  // App Store 3.1.1: dentro do app iOS não pode haver nenhum link/botão
  // relacionado a assinatura/pagamento externo (portal Stripe incluído).
  const isStripeSubscriber = access?.accessSource === "stripe" && !isIosApp();

  const handleSignOut = () => {
    setMobileMenuOpen(false);
    signOut({ redirectUrl: basePath || "/" });
  };

  const handleManageSubscription = async () => {
    if (openingPortal) return;
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error("Não foi possível abrir o portal de assinatura:", err);
      setOpeningPortal(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { href: "/dicionario", label: "Dicionário", icon: Music },
    { href: "/aplicacoes", label: "Aplicações", icon: Lightbulb },
    { href: "/sofisticador", label: "Sofisticador", icon: Wand2 },
    { href: "/audio-lab", label: "Audio Lab", icon: AudioWaveform },
    { href: "/metronomo", label: "Metrônomo", icon: Timer },
    { href: "/pad", label: "Pad", icon: Waves },
    { href: "/estudo", label: "Modo Estudo", icon: BookOpen },
    { href: "/favoritos", label: "Favoritos", icon: Heart, badge: totalFavoritos },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-surface/80 backdrop-blur-xl border-b border-foreground/5 shadow-sm"
          : "bg-background/40 backdrop-blur-md border-b border-transparent py-2"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-[4.5rem]">
            <Link href="/" className="flex items-center gap-2.5 shrink-0 mr-8 group outline-none opacity-90 hover:opacity-100 transition-opacity">
              <img
                src={`${basePath}/logo.svg`}
                alt=""
                aria-hidden="true"
                className="dark-only h-6 sm:h-7 w-auto select-none"
                draggable={false}
              />
              <img
                src={`${basePath}/logo-light.png`}
                alt=""
                aria-hidden="true"
                className="light-only h-6 sm:h-7 w-auto select-none"
                draggable={false}
              />
              <img
                src={`${basePath}/wordmark.svg`}
                alt="Kordi"
                className="dark-only h-4 sm:h-[1.15rem] w-auto select-none"
                draggable={false}
              />
              <img
                src={`${basePath}/wordmark-light.png`}
                alt="Kordi"
                className="light-only h-4 sm:h-[1.15rem] w-auto select-none"
                draggable={false}
              />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-sans font-medium whitespace-nowrap transition-all duration-200 outline-none",
                    location === item.href 
                      ? "text-primary bg-primary/10" 
                      : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                  )}
                >
                  <item.icon className="w-4 h-4 opacity-70" />
                  {item.label}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-1.5 bg-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
              <div className="w-px h-4 bg-foreground/10 mx-2" />
              <ThemeToggle variant="desktop" />
              {isStripeSubscriber && (
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  disabled={openingPortal}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-sans font-medium whitespace-nowrap text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all disabled:opacity-60"
                  title="Gerenciar assinatura"
                >
                  <CreditCard className="w-4 h-4 opacity-70" />
                  {openingPortal ? "Abrindo..." : "Assinatura"}
                </button>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-sans font-medium whitespace-nowrap text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
                title="Sair"
              >
                <LogOut className="w-4 h-4 opacity-70" />
                Sair
              </button>
            </nav>

            {/* Mobile Menu Toggle */}
            <button 
              className="lg:hidden p-2 rounded-lg text-muted-foreground hover:bg-foreground/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden fixed top-20 inset-x-0 z-40 glass border-b border-foreground/10"
          >
            <div className="px-4 py-6 space-y-2 flex flex-col">
              {navItems.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-4 rounded-xl text-base font-medium transition-all",
                    location === item.href 
                      ? "bg-primary/20 text-primary border border-primary/30" 
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
              <ThemeToggle variant="mobile" />
              {isStripeSubscriber && (
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  disabled={openingPortal}
                  className="flex items-center gap-3 px-4 py-4 rounded-xl text-base font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all w-full text-left disabled:opacity-60"
                >
                  <CreditCard className="w-5 h-5" />
                  {openingPortal ? "Abrindo..." : "Gerenciar assinatura"}
                </button>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-4 rounded-xl text-base font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all w-full text-left"
              >
                <LogOut className="w-5 h-5" />
                Sair
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 pt-20">
        {children}
      </main>

      <footer className="border-t border-foreground/5 py-8 mt-12 bg-surface/40">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground text-sm flex flex-col items-center gap-4">
          <img
            src={`${basePath}/logo.png`}
            alt="Kordi"
            className="dark-only w-8 h-8 rounded-lg opacity-70"
          />
          <img
            src={`${basePath}/logo-light.png`}
            alt="Kordi"
            className="light-only w-8 h-8 object-contain opacity-80"
          />
          <p>© {new Date().getFullYear()} Kordi. Ferramentas inteligentes para transformar o seu som.</p>
        </div>
      </footer>
    </div>
  );
}
