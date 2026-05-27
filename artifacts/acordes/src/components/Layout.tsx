import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Music, BookOpen, Heart, Menu, X, Lightbulb, Wand2, LogOut } from "lucide-react";
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
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { href: "/dicionario", label: "Dicionário", icon: Music },
    { href: "/aplicacoes", label: "Aplicações", icon: Lightbulb },
    { href: "/sofisticador", label: "Sofisticador", icon: Wand2 },
    { href: "/estudo", label: "Modo Estudo", icon: BookOpen },
    { href: "/favoritos", label: "Favoritos", icon: Heart, badge: totalFavoritos },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300 border-b border-transparent",
        isScrolled ? "glass shadow-lg" : "bg-transparent py-2"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link href="/" className="flex items-center group outline-none">
              <img
                src={`${basePath}/harmonic-logo-horizontal.png`}
                alt="Harmonic"
                className="h-14 sm:h-16 w-auto select-none group-hover:opacity-90 transition-opacity"
                draggable={false}
              />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 outline-none",
                    location === item.href 
                      ? "bg-white/10 text-white" 
                      : "text-muted-foreground hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-primary"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
              <button
                type="button"
                onClick={handleSignOut}
                className="ml-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-white transition-all"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </nav>

            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            className="md:hidden fixed top-[72px] inset-x-0 z-40 glass border-b border-white/10"
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
                      : "text-muted-foreground hover:bg-white/5 hover:text-white"
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
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-4 rounded-xl text-base font-medium text-muted-foreground hover:bg-white/5 hover:text-white transition-all w-full text-left"
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

      <footer className="border-t border-white/5 py-8 mt-12 bg-black/20">
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
