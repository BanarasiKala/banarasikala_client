import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "./HeroSlider.css";

const heroDesktopSlides = import.meta.glob(
  "../../../assets/hero/desktop/slide*.png",
  { eager: true, import: "default" },
);
const heroPhoneSlides = import.meta.glob(
  "../../../assets/hero/phone/slide*.png",
  { eager: true, import: "default" },
);

const getSlideNumber = (path) => Number(path.match(/slide(\d+)\.png$/)?.[1]);
const getSlideMap = (slides) =>
  Object.fromEntries(
    Object.entries(slides)
      .map(([path, image]) => [getSlideNumber(path), image])
      .filter(([id]) => Number.isFinite(id)),
  );

const desktopSlideMap = getSlideMap(heroDesktopSlides);
const phoneSlideMap = getSlideMap(heroPhoneSlides);

const HERO_SAREES = Object.keys(desktopSlideMap)
  .map(Number)
  .filter((id) => phoneSlideMap[id])
  .sort((a, b) => a - b)
  .map((id) => ({
    id,
    name: `Hero slide ${id}`,
    image: desktopSlideMap[id],
    mobileImage: phoneSlideMap[id],
  }));

const HeroSlider = () => (
  <div className="bk-hero-wrap">
    <Swiper
      modules={[Autoplay, Pagination, Navigation]}
      slidesPerView={1}
      autoplay={{ delay: 5500, disableOnInteraction: false }}
      loop
      navigation={{
        nextEl: ".hs-next",
        prevEl: ".hs-prev",
      }}
      pagination={{ clickable: true }}
      className="hero-swiper bk-hero-swiper"
    >
      {HERO_SAREES.map((slide, index) => (
        <SwiperSlide key={slide.id}>
          <picture>
            <source media="(max-width: 768px)" srcSet={slide.mobileImage} />
            <img
              src={slide.image}
              alt={slide.name}
              className="bk-hero-image"
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"}
              decoding={index === 0 ? "sync" : "async"}
            />
          </picture>
        </SwiperSlide>
      ))}

      <button
        className="hs-prev bk-hero-arrow bk-hero-arrow-prev"
        aria-label="Previous slide"
      >
        <svg
          width="17"
          height="17"
          fill="none"
          stroke="#2D1B0E"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button
        className="hs-next bk-hero-arrow bk-hero-arrow-next"
        aria-label="Next slide"
      >
        <svg
          width="17"
          height="17"
          fill="none"
          stroke="#2D1B0E"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </Swiper>
  </div>
);

export default HeroSlider;
