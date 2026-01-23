import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-foreground text-background py-16 lg:py-20">
      <div className="container mx-auto px-4 lg:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12 lg:mb-16">
          {/* Company */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img
                src="/evidentlyaeo-logo.png"
                alt="EvidentlyAEO Logo"
                className="h-8 w-8 object-contain"
                width="32"
                height="32"
                loading="lazy"
              />
              <span className="font-bold">EvidentlyAEO</span>
            </div>
            <p className="text-sm text-background/70">© 2025 EvidentlyAEO. All rights reserved.</p>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h4 className="font-semibold text-background text-sm uppercase tracking-wide">Product</h4>
            <ul className="space-y-2">
              {["Features", "Pricing", "Security", "Documentation"].map((link) => (
                <li key={link}>
                  <Link to="#" className="text-sm text-background/70 hover:text-background transition-colors">
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-4">
            <h4 className="font-semibold text-background text-sm uppercase tracking-wide">Company</h4>
            <ul className="space-y-2">
              {["About", "Blog", "Careers", "Contact"].map((link) => (
                <li key={link}>
                  <Link to="#" className="text-sm text-background/70 hover:text-background transition-colors">
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="font-semibold text-background text-sm uppercase tracking-wide">Legal</h4>
            <ul className="space-y-2">
              {["Privacy Policy", "Terms of Service", "Cookie Policy", "Compliance"].map((link) => (
                <li key={link}>
                  <Link to="#" className="text-sm text-background/70 hover:text-background transition-colors">
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-background/20 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-background/70">Trusted by 500+ marketing teams worldwide</p>
          <div className="flex gap-4">
            <Link to="#" className="text-background/70 hover:text-background transition-colors">
              <span className="text-sm">LinkedIn</span>
            </Link>
            <Link to="#" className="text-background/70 hover:text-background transition-colors">
              <span className="text-sm">Twitter</span>
            </Link>
            <Link to="#" className="text-background/70 hover:text-background transition-colors">
              <span className="text-sm">GitHub</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
