import HeroBlock from "./HeroBlock.jsx";
import ProductHighlightBlock from "./ProductHighlightBlock.jsx";
import OrderFormBlock from "./OrderFormBlock.jsx";
import TestimonialsBlock from "./TestimonialsBlock.jsx";
import CountdownBlock from "./CountdownBlock.jsx";
import FaqBlock from "./FaqBlock.jsx";
import TrustBadgesBlock from "./TrustBadgesBlock.jsx";
import StickyOrderBarBlock from "./StickyOrderBarBlock.jsx";
import WhatsappCtaBlock from "./WhatsappCtaBlock.jsx";

// type -> component lookup used by /lp/[slug]/page.jsx. Adding a new block
// type is additive: a new entry here plus a new component file, nothing
// existing has to change. An unrecognized `type` (stale data, a block the
// renderer doesn't know about yet) simply isn't in this map — the page skips
// it rather than crashing.
const registry = {
    hero: HeroBlock,
    productHighlight: ProductHighlightBlock,
    orderForm: OrderFormBlock,
    testimonials: TestimonialsBlock,
    countdown: CountdownBlock,
    faq: FaqBlock,
    trustBadges: TrustBadgesBlock,
    stickyOrderBar: StickyOrderBarBlock,
    whatsappCta: WhatsappCtaBlock,
};

export default registry;
