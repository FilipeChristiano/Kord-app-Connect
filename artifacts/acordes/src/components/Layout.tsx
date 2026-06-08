import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Music, BookOpen, Heart, Menu, X, Lightbulb, Wand2, LogOut, Timer, Waves } from "lucide-react";
import { useClerk } from "@clerk/react";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/hooks/use-favorites";
import { useCifrasFavoritas } from "@/hooks/use-cifras-favoritas";
import { motion, AnimatePresence } from "framer-motion";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { favoritesCount } = useFavorites();
  const { cifrasCount } = useCifrasFavoritas();
  const totalFavoritos = favoritesCount + cifrasCount;
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signOut } = useClerk();

  const handleSignOut = () => {
    setMobileMenuOpen(false);
    signOut({ redirectUrl: basePath || "/" });
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 16);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { href: "/dicionario", label: "Dicionário", icon: Music },
    { href: "/aplicacoes", label: "Aplicações", icon: Lightbulb },
    { href: "/sofisticador", label: "Sofisticador", icon: Wand2 },
    { href: "/metronomo", label: "Metrônomo", icon: Timer },
    { href: "/pad", label: "Pad", icon: Waves },
    { href: "/estudo", label: "Modo Estudo", icon: BookOpen },
    { href: "/favoritos", label: "Favoritos", icon: Heart, badge: totalFavoritos },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Header */}
      <header
        className={cn(
          "sticky top-0 z-50 transition-all duration-300",
          isScrolled
            ? "glass border-b border-white/5"
            : "bg-background/70 backdrop-blur-md border-b border-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center outline-none rounded-xl">
              <img
                src={`${basePath}/harmonic-logo-horizontal.png`}
                alt="Harmonic"
                className="h-9 w-auto select-none transition-opacity hover:opacity-90"
                draggable={false}
              />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const active = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                    )}
                  >
                    <item.icon className={cn("w-4 h-4 shrink-0 transition-transform duration-200", !active && "group-hover:scale-110")} />
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={handleSignOut}
                className="ml-1 flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-all outline-none"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </nav>

            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 rounded-lg text-muted-foreground hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              id="mobile-nav-drawer"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden glass border-t border-white/10 overflow-hidden"
            >
              <div className="px-4 py-5 space-y-1.5 flex flex-col max-w-7xl mx-auto">
                {navItems.map((item) => {
                  const active = location === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 outline-none",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                      )}
                    >
                      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary" />}
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-3 py-2.5 mt-1 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all w-full text-left"
                >
                  <LogOut className="w-5 h-5" />
                  Sair
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/5 py-8 mt-12 bg-surface/40">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground text-sm flex flex-col items-center gap-4">
          <img
            src={`${basePath}/logo.png`}
            alt="Harmonic"
            className="w-8 h-8 rounded-lg opacity-70"
          />
          <p>© {new Date().getFullYear()} Harmonic. Uma ferramenta para tecladistas.</p>
        </div>
      </footer>
    </div>
  );
}
