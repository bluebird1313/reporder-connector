import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy - RepOrder",
  description: "Privacy Policy for RepOrder inventory sync platform",
}

export default function PrivacyPolicyPage() {
  const lastUpdated = "November 28, 2024"
  const contactEmail = "support@reporder.io"

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">R</span>
            </div>
            <span className="font-semibold text-lg">RepOrder</span>
          </Link>
          <Link 
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
          </div>

          {/* Introduction */}
          <section className="space-y-4">
            <p className="text-lg text-muted-foreground leading-relaxed">
              RepOrder (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, and safeguard information when you use 
              our inventory sync application.
            </p>
          </section>

          {/* Sections */}
          <div className="space-y-10">
            
            {/* Section 1 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold border-b border-border pb-2">
                1. Information We Collect
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                When you connect your store to RepOrder, we access and collect the following information 
                from your retail platform (Shopify, Lightspeed, Square, etc.):
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong className="text-foreground">Product Information:</strong> Product names, titles, SKUs, barcodes, and descriptions</li>
                <li><strong className="text-foreground">Inventory Data:</strong> Stock quantities and inventory levels at each location</li>
                <li><strong className="text-foreground">Vendor/Brand Information:</strong> Product vendor and brand names</li>
                <li><strong className="text-foreground">Location Data:</strong> Store location names and identifiers</li>
                <li><strong className="text-foreground">Store Information:</strong> Store name and domain</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                We only request <strong className="text-foreground">read-only access</strong> to your data. 
                RepOrder does not modify, create, or delete any data in your store.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold border-b border-border pb-2">
                2. How We Use Your Information
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We use the collected information solely to provide our inventory sync services:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Display inventory levels in the RepOrder dashboard</li>
                <li>Generate low-stock alerts based on thresholds you configure</li>
                <li>Create restock request reports for your review</li>
                <li>Sync inventory data between your store and our platform</li>
                <li>Enable brand/vendor filtering based on your preferences</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold border-b border-border pb-2">
                3. Brand Selection & Data Filtering
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                RepOrder gives you control over which brands and vendors are synced:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>After connecting your store, you select which brands/vendors to share</li>
                <li>Only products from your approved brands are synced and stored</li>
                <li>Products from non-selected brands are <strong className="text-foreground">never fetched or stored</strong></li>
                <li>You can update your brand selection at any time</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold border-b border-border pb-2">
                4. Data Sharing
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We do not sell, trade, or otherwise transfer your information to third parties. 
                Your data may only be shared in these limited circumstances:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong className="text-foreground">Service Providers:</strong> We use trusted third-party services 
                  (hosting, database) that process data on our behalf under strict confidentiality agreements</li>
                <li><strong className="text-foreground">Legal Requirements:</strong> If required by law or to protect our rights</li>
                <li><strong className="text-foreground">With Your Consent:</strong> When you explicitly authorize sharing</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold border-b border-border pb-2">
                5. Data Security
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate security measures to protect your information:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>All data is transmitted over encrypted HTTPS connections</li>
                <li>Access tokens are stored securely and encrypted at rest</li>
                <li>We use industry-standard authentication protocols (OAuth 2.0)</li>
                <li>Database access is restricted and monitored</li>
                <li>Regular security reviews and updates</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold border-b border-border pb-2">
                6. Data Retention
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your data only as long as necessary to provide our services:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong className="text-foreground">While Installed:</strong> Data is retained while the app is installed on your store</li>
                <li><strong className="text-foreground">After Uninstall:</strong> When you uninstall RepOrder, we delete your store data 
                  within 30 days, including products, inventory levels, and access tokens</li>
                <li><strong className="text-foreground">Upon Request:</strong> You can request immediate deletion at any time</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold border-b border-border pb-2">
                7. Your Rights (GDPR & CCPA)
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Depending on your location, you may have the following rights:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong className="text-foreground">Access:</strong> Request a copy of your data we hold</li>
                <li><strong className="text-foreground">Correction:</strong> Request correction of inaccurate data</li>
                <li><strong className="text-foreground">Deletion:</strong> Request deletion of your data</li>
                <li><strong className="text-foreground">Portability:</strong> Request your data in a portable format</li>
                <li><strong className="text-foreground">Objection:</strong> Object to certain processing of your data</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                To exercise any of these rights, please contact us at{" "}
                <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                  {contactEmail}
                </a>
              </p>
            </section>

            {/* Section 8 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold border-b border-border pb-2">
                8. Cookies & Tracking
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                RepOrder uses minimal cookies necessary for the application to function:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong className="text-foreground">Session Cookies:</strong> To maintain your logged-in state</li>
                <li><strong className="text-foreground">Security Cookies:</strong> For CSRF protection during OAuth</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                We do not use tracking cookies or third-party advertising cookies.
              </p>
            </section>

            {/* Section 9 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold border-b border-border pb-2">
                9. Third-Party Platforms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                RepOrder integrates with third-party retail platforms. Your use of those platforms 
                is governed by their respective privacy policies:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>
                  <a href="https://www.shopify.com/legal/privacy" target="_blank" rel="noopener noreferrer" 
                     className="text-primary hover:underline">
                    Shopify Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="https://www.lightspeedhq.com/legal/privacy-policy/" target="_blank" rel="noopener noreferrer"
                     className="text-primary hover:underline">
                    Lightspeed Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="https://squareup.com/legal/privacy" target="_blank" rel="noopener noreferrer"
                     className="text-primary hover:underline">
                    Square Privacy Policy
                  </a>
                </li>
              </ul>
            </section>

            {/* Section 10 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold border-b border-border pb-2">
                10. Changes to This Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any 
                significant changes by posting a notice in the app or sending an email. Your continued 
                use of RepOrder after changes are posted constitutes acceptance of the updated policy.
              </p>
            </section>

            {/* Section 11 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold border-b border-border pb-2">
                11. Contact Us
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, 
                please contact us:
              </p>
              <div className="bg-card border border-border rounded-lg p-6 space-y-2">
                <p className="font-medium">RepOrder</p>
                <p className="text-muted-foreground">
                  Email:{" "}
                  <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                    {contactEmail}
                  </a>
                </p>
              </div>
            </section>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} RepOrder. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

