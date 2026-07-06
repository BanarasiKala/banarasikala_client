import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { getSavedScroll } from "../../utils/scrollRestore";
import headerBackground from "../../assets/header_backgroung.png";
import FabricStrip from "./FabricStrip/FabricStrip";
import HeroSlider from "./HeroSlider/HeroSlider";
import OfferBand from "./OfferBand/OfferBand";
import "./Home.css";

const WhyChooseUs = lazy(() => import("./WhyChooseUs/WhyChooseUs"));
const BanarasRoyale = lazy(() => import("./BanarasRoyale/BanarasRoyale"));
const BanarasInMotion = lazy(() => import("./BanarasInMotion/BanarasInMotion"));
const BoxSection = lazy(() => import("./BoxSection/BoxSection"));
const PopularSarees = lazy(() => import("./PopularSarees/PopularSarees"));
const BrowseCircles = lazy(() => import("./BrowseCircles/BrowseCircles"));
const NewArrivals = lazy(() => import("./NewArrivals/NewArrivals"));
const OccasionCollections = lazy(() => import("./OccasionCollections/OccasionCollections"));
const ReviewsStory = lazy(() => import("./ReviewsStory/ReviewsStory"));
const FaqSection = lazy(() => import("./FaqSection/FaqSection"));

const HomeSection = ({ children, id, variant = "default" }) => {
  const ref = useRef(null);
  const navType = useNavigationType();
  const location = useLocation();
  // On a back/forward restore to a saved scroll position, render every section
  // immediately so the page has its true height at first paint and the browser
  // can land on the exact offset (otherwise the reserved placeholder heights
  // under-estimate tall grids like Exclusive Picks and the page lands short).
  const [active, setActive] = useState(
    () => navType === "POP" && getSavedScroll(location.key) > 0
  );

  useEffect(() => {
    if (active) return undefined; // already rendered (restore) — no observer needed
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [active]);

  return (
    <div
      id={id}
      ref={ref}
      className={`home-deferred-section home-deferred-section--${variant}${active ? " is-rendered" : ""}`}
    >
      <Suspense fallback={<div className="home-section-loader" aria-hidden="true" />}>
        {active ? children : <div className="home-section-loader" aria-hidden="true" />}
      </Suspense>
    </div>
  );
};

const Home = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash !== "#new-arrivals") return undefined;

    let timer = null;
    let attempts = 0;

    const getHeaderOffset = () => {
      const header = document.querySelector(".bk-header");
      const headerHeight = header?.getBoundingClientRect().height || 0;
      return headerHeight + 58;
    };

    const scrollToHeading = () => {
      const heading = document.getElementById("new-arrivals-heading");
      const fallback = document.getElementById("new-arrivals");
      const target = heading || fallback;
      if (!target) return false;

      const top = target.getBoundingClientRect().top + window.scrollY - getHeaderOffset();
      window.scrollTo({ top: Math.max(0, top), behavior: attempts === 0 ? "auto" : "smooth" });
      return Boolean(heading);
    };

    const runScroll = () => {
      const foundHeading = scrollToHeading();
      attempts += 1;

      if (!foundHeading && attempts < 12) {
        timer = window.setTimeout(runScroll, 180);
      }
    };

    timer = window.setTimeout(runScroll, 60);

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [location.hash]);

  return (
    <div
      className="home-page"
      style={{
        "--bk-section-bg": `url(${headerBackground})`,
        "--bk-header-bg": `url(${headerBackground})`,
      }}
    >
      <main className="bk-home-main">
        <FabricStrip />
        <OfferBand />
        <HeroSlider />

        <HomeSection variant="why"><WhyChooseUs /></HomeSection>
        <HomeSection variant="royale"><BanarasRoyale /></HomeSection>
        <HomeSection variant="occasion"><OccasionCollections /></HomeSection>
        <HomeSection id="new-arrivals" variant="arrivals"><NewArrivals /></HomeSection>
        <HomeSection variant="motion"><BanarasInMotion /></HomeSection>
        <HomeSection variant="browse"><BrowseCircles /></HomeSection>
        <HomeSection variant="boxes"><BoxSection /></HomeSection>
        <HomeSection variant="popular"><PopularSarees /></HomeSection>
        <HomeSection variant="reviews"><ReviewsStory /></HomeSection>
        <HomeSection variant="faq"><FaqSection /></HomeSection>
      </main>
    </div>
  );
};

export default Home;
