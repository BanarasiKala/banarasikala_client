import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import "swiper/css";
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
      modules={[Pagination]}
      slidesPerView={1}
      loop
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
    </Swiper>
  </div>
);

export default HeroSlider;
