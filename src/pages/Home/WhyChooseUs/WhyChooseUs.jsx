import {
  Award,
  HandHeart,
  Landmark,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import "./WhyChooseUs.css";

const WHY_CHOOSE_US = [
  { title: "100% Authentic", subtitle: "Banarasi Sarees", icon: Award },
  { title: "Handpicked", subtitle: "Premium Quality", icon: HandHeart },
  { title: "Secure", subtitle: "Payments", icon: ShieldCheck },
  { title: "Easy", subtitle: "Returns", icon: RotateCcw },
  { title: "Direct From", subtitle: "Banaras", icon: Landmark },
  { title: "Fast & Reliable", subtitle: "Delivery", icon: Truck },
];

const WhyChooseUs = () => (
  <section className="bk-why-choose" aria-labelledby="why-choose-title">
    <div className="bk-why-shell">
      <div className="bk-why-heading">
        <h2 id="why-choose-title">Why Choose Us</h2>
        <span aria-hidden="true" />
      </div>
    </div>

    <div className="bk-why-track-wrap">
      <Swiper
        modules={[FreeMode]}
        freeMode
        slidesPerView="auto"
        grabCursor
        className="bk-why-swiper"
      >
        {WHY_CHOOSE_US.map(({ title, subtitle, icon: Icon }, i) => (
          <SwiperSlide key={i} className="bk-why-slide">
            <div className="bk-why-item">
              <Icon className="bk-why-icon" strokeWidth={1.8} />
              <p>
                <span>{title}</span>
                <span>{subtitle}</span>
              </p>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  </section>
);

export default WhyChooseUs;
