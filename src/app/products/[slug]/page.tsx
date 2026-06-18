import { notFound } from "next/navigation";
import type { Metadata } from "next";
import xss from "xss";
import { sanityClient } from "@/lib/sanity/client";
import { getProductBySlug } from "@/lib/sanity/queries/products";
import { ProductGallery, ProductAttributes, AddToCart } from "@/ui/components/pdp";
import { Breadcrumbs } from "@/ui/components/breadcrumbs";
import { formatMoney } from "@/lib/utils";

type PageProps = {
	params: Promise<{ slug: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
	const { slug } = await props.params;

	// Handle the build-time placeholder slug when Sanity data is unavailable
	if (slug === PLACEHOLDER_SLUG) {
		return { title: "Produit introuvable" };
	}

	const product = await getProductBySlug(slug);

	if (!product) {
		return { title: "Produit introuvable" };
	}

	return {
		title: `${product.name} · Storefront`,
		description: product.description || product.name,
	};
}

// Placeholder slug used when Sanity data is unavailable at build time.
// This ensures `output: "export"` can validate the route. The placeholder
// is handled in the page component via `notFound()`.
const PLACEHOLDER_SLUG = "__no_products__";

export async function generateStaticParams() {
	try {
		const products = await sanityClient.fetch<
			Array<{
				slug: {
					current: string;
				};
			}>
		>('*[_type == "product" && defined(slug.current)]{slug}');

		if (!products || products.length === 0) {
			console.warn("[generateStaticParams] No products found in Sanity, returning placeholder");
			return [{ slug: PLACEHOLDER_SLUG }];
		}

		return products.map((product) => ({
			slug: product.slug.current,
		}));
	} catch (error) {
		console.error("[generateStaticParams] Failed to fetch products from Sanity:", error);
		// Return a placeholder so Next.js can validate the route for static export.
		// The placeholder page will render a 404 at runtime.
		return [{ slug: PLACEHOLDER_SLUG }];
	}
}

export default async function ProductPage(props: PageProps) {
	const { slug } = await props.params;

	// Handle the build-time placeholder slug when Sanity data is unavailable
	if (slug === PLACEHOLDER_SLUG) {
		notFound();
	}

	const product = await getProductBySlug(slug);

	if (!product) {
		notFound();
	}

	const images =
		product.images?.map((img) => ({ url: img.url, alt: img.alt || product.name })) ?? [];

	const descriptionHtml = product.description ? [xss(`<p>${product.description}</p>`)] : null;

	const breadcrumbs = [{ label: "Accueil", href: "/" }, { label: product.name }];

	const priceAmount = product.price?.amount ?? 0;
	const priceCurrency = product.price?.currency ?? "XOF";
	const priceLabel = formatMoney(priceAmount, priceCurrency);
	const fallbackImage = images[0]?.url ?? "/placeholder.svg";

	// Server-side debug: log product data if name is unexpectedly empty
	if (!product.name || !product.name.toString().trim()) {
		// eslint-disable-next-line no-console
		console.warn("[ProductPage] product.name is empty for slug:", slug, "product:", JSON.stringify(product));
	}

	const displayName = product.name && product.name.trim() ? product.name : (product.slug ?? "Produit").toString().replace(/-/g, " ");

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-10">
				<div className="mb-6 hidden sm:block">
					<Breadcrumbs items={breadcrumbs} />
				</div>

				<div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
					<div className="lg:sticky lg:top-24 lg:self-start">
						<ProductGallery images={images} productName={product.name} />
					</div>

					<div className="flex flex-col gap-4">
						<h1 className="text-balance text-3xl font-semibold tracking-tight lg:text-4xl">
							{displayName}
						</h1>
						<AddToCart
							price={priceLabel}
							priceAmount={priceAmount}
							currency={priceCurrency}
							productId={product._id}
							name={product.name}
							slug={product.slug}
							image={fallbackImage}
						/>
						<div className="mt-6">
							<ProductAttributes descriptionHtml={descriptionHtml} />
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
