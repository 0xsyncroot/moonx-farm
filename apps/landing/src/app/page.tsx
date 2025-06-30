'use client'

import { ArrowRight, Shield, Zap, Heart, TrendingUp, Users, Clock, Star, Play, ChevronDown, Menu, X } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useState } from 'react'

// Environment variables with fallbacks
const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'https://app.moonx.farm'
const SHOW_DEMO_VIDEO = process.env.NEXT_PUBLIC_SHOW_DEMO_VIDEO === 'true'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  return (
    <div className={`mobile-menu ${isOpen ? 'open' : 'closed'} md:hidden`}>
      <div className="safe-area-top">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <Image
              src="/logo.png"
              alt="MoonX Farm Logo"
              width={24}
              height={24}
              className="rounded"
            />
            <span className="text-lg font-bold text-gradient">MoonX Farm</span>
          </div>
          <button
            onClick={onClose}
            className="touch-target p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-4 space-y-4">
          <a 
            href="#features" 
            className="block py-3 px-4 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors touch-target"
            onClick={onClose}
          >
            Features
          </a>
          <a 
            href="#how-it-works" 
            className="block py-3 px-4 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors touch-target"
            onClick={onClose}
          >
            How it Works
          </a>
          <a 
            href="#about" 
            className="block py-3 px-4 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors touch-target"
            onClick={onClose}
          >
            About
          </a>
        </nav>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLaunchApp = () => {
    window.open(MAIN_APP_URL, '_blank', 'noopener,noreferrer')
  }

  const handleDemoClick = () => {
    if (SHOW_DEMO_VIDEO) {
      // In production, this would open a demo video modal or redirect
      console.log('Demo video feature - implementation pending')
    }
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
      {/* Navigation */}
      <nav className="relative z-50 nav-responsive">
        <div className="container-responsive flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image
              src="/logo.png"
              alt="MoonX Farm Logo"
              width={32}
              height={32}
              className="rounded-lg"
              priority
            />
            <span className="text-lg sm:text-xl font-bold text-gradient">
              MoonX Farm
            </span>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
            <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-gray-300 hover:text-white transition-colors">How it Works</a>
            <a href="#about" className="text-gray-300 hover:text-white transition-colors">About</a>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button onClick={handleLaunchApp} className="btn-jupiter hidden xs:flex">
              <span className="hidden sm:inline">Launch App</span>
              <span className="sm:hidden">Launch</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            
            {/* Mobile menu button */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden touch-target p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* Hero Section */}
      <section className="relative hero-spacing text-center">
        <div className="container-responsive max-w-6xl">
          {/* Background decoration - hidden on mobile for performance */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block">
            <div className="floating-orb w-64 md:w-80 h-64 md:h-80 bg-orange-500/20 -top-32 md:-top-40 -left-32 md:-left-40"></div>
            <div className="floating-orb w-72 md:w-96 h-72 md:h-96 bg-orange-400/15 -bottom-32 md:-bottom-40 -right-32 md:-right-40" style={{animationDelay: '1s'}}></div>
            <div className="floating-orb w-48 md:w-64 h-48 md:h-64 bg-purple-500/10 top-16 md:top-20 right-1/4" style={{animationDelay: '2s'}}></div>
          </div>

          <div className="relative z-10 space-y-6 sm:space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center px-3 py-2 sm:px-4 sm:py-2 rounded-full glass-mobile mb-4 sm:mb-8">
              <Star className="w-3 h-3 sm:w-4 sm:h-4 text-orange-400 mr-2" />
              <span className="text-xs sm:text-sm font-medium">The Future of DEX Trading</span>
            </div>

            {/* Main headline */}
            <h1 className="heading-responsive font-bold leading-tight">
              Trade
              <span className="text-gradient"> Gasless</span>
              <br />
              With Smart Wallets
            </h1>

            {/* Subtitle */}
            <p className="body-responsive text-gray-300 max-w-4xl mx-auto leading-relaxed">
              The first multi-aggregator DEX with Account Abstraction. 
              Trade with social login, pay zero gas fees, and get the best prices across all DEXs.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-12 lg:mb-16">
              <Button 
                size="lg" 
                onClick={handleLaunchApp} 
                className="btn-jupiter text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4"
              >
                Start Trading Now
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              {SHOW_DEMO_VIDEO && (
                <Button 
                  size="lg" 
                  variant="outline" 
                  onClick={handleDemoClick}
                  className="text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 glass-mobile hover:bg-white/20"
                >
                  <Play className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Watch Demo
                </Button>
              )}
            </div>

            {/* Trust signals */}
            <div className="grid-responsive-3 max-w-5xl mx-auto">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-orange-400 mb-2">$2.5M+</div>
                <div className="text-sm sm:text-base text-gray-400">Total Volume Traded</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-orange-400 mb-2">10K+</div>
                <div className="text-sm sm:text-base text-gray-400">Gasless Transactions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-orange-400 mb-2">99.9%</div>
                <div className="text-sm sm:text-base text-gray-400">Uptime</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce hidden sm:block">
          <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="section-spacing bg-black/20">
        <div className="container-responsive">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h2 className="subheading-responsive font-bold mb-4 sm:mb-6">
              Why Choose 
              <span className="text-gradient"> MoonX</span>
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-300 max-w-3xl mx-auto">
              Experience the future of DeFi trading with cutting-edge technology and user-first design
            </p>
          </div>

          <div className="grid-responsive-3">
            {/* Feature 1 */}
            <Card className="feature-card group">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Gasless Trading</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  Your first 10 trades are completely free. No gas fees, no friction - just pure trading experience.
                </p>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="feature-card group">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                  <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Social Login</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  Sign in with Google, Twitter, or email. No seed phrases, no wallet downloads - onboard in seconds.
                </p>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="feature-card group">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Best Prices</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  Multi-aggregator routing across LI.FI, 1inch, and Relay ensures you always get the best rates.
                </p>
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card className="feature-card group">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">MEV Protection</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  Built-in protection against MEV attacks. Your trades are shielded from front-running and sandwich attacks.
                </p>
              </CardContent>
            </Card>

            {/* Feature 5 */}
            <Card className="feature-card group">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Advanced Orders</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  Set limit orders and DCA strategies. Automate your trading with smart contract execution.
                </p>
              </CardContent>
            </Card>

            {/* Feature 6 */}
            <Card className="feature-card group">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Multi-Chain</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  Trade across Base and BSC networks. Seamless cross-chain experience with unified liquidity.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="section-spacing">
        <div className="container-responsive max-w-6xl">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h2 className="subheading-responsive font-bold mb-4 sm:mb-6">
              Get Started in 
              <span className="text-gradient"> 30 Seconds</span>
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-300">
              The simplest onboarding experience in DeFi
            </p>
          </div>

          <div className="grid-responsive-3 relative">
            {/* Step 1 */}
            <div className="text-center relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 flex items-center justify-center mx-auto mb-4 sm:mb-6 text-lg sm:text-2xl font-bold">
                1
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Connect Socially</h3>
              <p className="text-sm sm:text-base text-gray-300">
                Sign in with your Google, Twitter, or email account. No downloads required.
              </p>
              
              {/* Connector line - hidden on mobile */}
              <div className="hidden lg:block absolute top-6 sm:top-8 left-full w-full h-0.5 bg-gradient-to-r from-orange-400 to-transparent z-0"></div>
            </div>

            {/* Step 2 */}
            <div className="text-center relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 flex items-center justify-center mx-auto mb-4 sm:mb-6 text-lg sm:text-2xl font-bold">
                2
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Smart Wallet Created</h3>
              <p className="text-sm sm:text-base text-gray-300">
                Your Account Abstraction wallet is automatically created and secured.
              </p>
              
              {/* Connector line - hidden on mobile */}
              <div className="hidden lg:block absolute top-6 sm:top-8 left-full w-full h-0.5 bg-gradient-to-r from-orange-400 to-transparent z-0"></div>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 flex items-center justify-center mx-auto mb-4 sm:mb-6 text-lg sm:text-2xl font-bold">
                3
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Start Trading</h3>
              <p className="text-sm sm:text-base text-gray-300">
                Begin trading immediately with gasless transactions and best prices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section-spacing bg-gradient-to-r from-orange-500/5 to-orange-400/5">
        <div className="container-responsive">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h2 className="subheading-responsive font-bold mb-4 sm:mb-6">
              Trusted by Thousands
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-300">
              Join the growing community of smart traders
            </p>
          </div>

          <div className="grid-responsive-4">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient mb-2">97%</div>
              <div className="text-sm sm:text-base text-gray-400">Completion Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient mb-2">&lt;200ms</div>
              <div className="text-sm sm:text-base text-gray-400">Quote Speed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient mb-2">5+</div>
              <div className="text-sm sm:text-base text-gray-400">Supported Chains</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient mb-2">24/7</div>
              <div className="text-sm sm:text-base text-gray-400">Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-spacing bg-gradient-to-r from-orange-500/10 to-orange-400/10">
        <div className="container-responsive max-w-5xl text-center">
          <h2 className="subheading-responsive font-bold mb-4 sm:mb-6">
            Ready to Trade Smarter?
          </h2>
          <p className="body-responsive text-gray-300 mb-8 sm:mb-12 max-w-3xl mx-auto">
            Join thousands of traders who have discovered the future of DeFi trading. 
            Your first 10 trades are on us.
          </p>
          
          <Button 
            size="lg" 
            onClick={handleLaunchApp} 
            className="btn-jupiter text-lg sm:text-xl px-8 sm:px-12 py-4 sm:py-6"
          >
            Launch MoonX App
            <ArrowRight className="ml-2 sm:ml-3 h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
          
          <p className="text-xs sm:text-sm text-gray-400 mt-4 sm:mt-6">
            No installation required • Gasless trading • Social login
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer id="about" className="section-spacing border-t border-white/10 safe-area-bottom">
        <div className="container-responsive">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
            <div className="col-span-1 sm:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <Image
                  src="/logo.png"
                  alt="MoonX Farm Logo"
                  width={24}
                  height={24}
                  className="rounded"
                />
                <span className="text-base sm:text-lg font-bold text-gradient">
                  MoonX Farm
                </span>
              </div>
              <p className="text-sm sm:text-base text-gray-400 mb-4 max-w-md">
                The future of DeFi trading with Account Abstraction, gasless transactions, 
                and best-in-class user experience.
              </p>
            </div>
            
            <div>
              <h4 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">Product</h4>
              <ul className="space-y-2 text-xs sm:text-sm text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a></li>
                <li><button onClick={handleLaunchApp} className="hover:text-white transition-colors text-left">Trading App</button></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">Company</h4>
              <ul className="space-y-2 text-xs sm:text-sm text-gray-400">
                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-between pt-6 sm:pt-8 border-t border-white/10 space-y-4 sm:space-y-0">
            <div className="text-xs sm:text-sm text-gray-400 text-center sm:text-left">
              © 2025 MoonX Farm. All rights reserved.
            </div>
            
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6 text-xs sm:text-sm text-gray-400">
              <span>Built with ❤️ for DeFi</span>
              <span className="hidden sm:inline">•</span>
              <span>Powered by Account Abstraction</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
} 