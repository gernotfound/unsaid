type ProductPageProps = { params: Promise<{ slug: string }> };
export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  return <main id="main" className="shell"><h1>{slug}</h1><p>Product detail route. Fronte e retro sono asset distinti e immutabili.</p></main>;
}
