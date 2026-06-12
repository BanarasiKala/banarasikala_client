import { Icon } from "@iconify/react";
import { useEffect } from "react";
import "./Testimonials.css";

const Testimonials = () => {
  // Artisan Videos - Short Form (9:16 like Reels)
  const artisanVideos = [
    {
      id: 1,
      title: "How We Make Sarees",
      artisan: "Ramesh ji",
      experience: "40 years",
      thumbnail:
        "https://images.unsplash.com/photo-1590736969955-71cc94901144?w=400&h=700&fit=crop",
      videoId: "5Peo-ivmupE",
      likes: "12.5K",
      views: "45K",
    },
    {
      id: 2,
      title: "Gold Thread Work",
      artisan: "Shanti Devi",
      experience: "35 years",
      thumbnail:
        "https://images.unsplash.com/photo-1606293926075-69a00febf780?w=400&h=700&fit=crop",
      videoId: "0n6z8LHybWc",
      likes: "8.2K",
      views: "32K",
    },
    {
      id: 3,
      title: "Color Magic",
      artisan: "Hari Prasad",
      experience: "30 years",
      thumbnail:
        "https://images.unsplash.com/photo-1610128114197-485d943d86b5?w=400&h=700&fit=crop",
      videoId: "s6zU_E6YizE",
      likes: "15K",
      views: "58K",
    },
    {
      id: 4,
      title: "Final Touch",
      artisan: "Gita Devi",
      experience: "25 years",
      thumbnail:
        "https://images.unsplash.com/photo-1583391733951-1d8a5654e754?w=400&h=700&fit=crop",
      videoId: "2Vv-BfVoq4g",
      likes: "9.8K",
      views: "38K",
    },
    {
      id: 5,
      title: "Silk to Saree",
      artisan: "Mohan Lal",
      experience: "45 years",
      thumbnail:
        "https://images.unsplash.com/photo-1609249267371-b6a62543393c?w=400&h=700&fit=crop",
      videoId: "dQw4w9WgXcQ",
      likes: "22K",
      views: "89K",
    },
    {
      id: 6,
      title: "Design Process",
      artisan: "Sunita Devi",
      experience: "28 years",
      thumbnail:
        "https://images.unsplash.com/photo-1610030464700-41a0a1a9f0ce?w=400&h=700&fit=crop",
      videoId: "3JZ_D3ELwOQ",
      likes: "11K",
      views: "41K",
    },
  ];

  const openVideo = (videoId) => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
  };

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("active");
        }
      });
    }, observerOptions);

    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F1E8] pt-8">
      {/* Artisan Short Videos - Auto Scrolling Carousel */}
      <section className="py-24 bg-gradient-to-br from-[#FFF8F0] via-[#F5F1E8] to-[#FFF8F0] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#800020] via-[#D4AF37] to-[#800020]"></div>
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#D4AF37]/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-64 h-64 bg-[#800020]/10 rounded-full blur-3xl"></div>

        <div className="w-full px-4 lg:px-12 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-[#800020] mb-4 brand-font uppercase tracking-widest reveal">
              Our Artists At Work
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-[#800020] via-[#D4AF37] to-[#800020] mx-auto mb-6 reveal"></div>
            <p className="text-gray-600 max-w-2xl mx-auto reveal text-lg">
              See how our skilled artists make beautiful sarees by hand. Short
              videos like Reels!
            </p>
          </div>

          {/* Auto Scrolling Video Carousel */}
          <div className="relative overflow-hidden">
            <div className="video-carousel flex gap-4 animate-scroll-left">
              {/* First set of videos */}
              {artisanVideos.map((video) => (
                <div
                  key={`first-${video.id}`}
                  className="group cursor-pointer flex-shrink-0"
                  onClick={() => openVideo(video.videoId)}
                >
                  <div className="relative w-[200px] aspect-[9/16] rounded-2xl overflow-hidden shadow-lg group-hover:shadow-2xl transition-all duration-300 group-hover:-translate-y-2 border-2 border-transparent group-hover:border-[#D4AF37]">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#800020] via-transparent to-transparent opacity-80"></div>

                    {/* Play Button */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-lg animate-pulse-slow">
                        <Icon
                          icon="lucide:play"
                          className="text-xl text-[#800020] ml-0.5"
                        ></Icon>
                      </div>
                    </div>

                    {/* Video Info */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="text-white font-bold text-sm mb-1 line-clamp-1">
                        {video.title}
                      </h3>
                      <p className="text-[#D4AF37] text-xs font-medium">
                        {video.artisan}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-white/80 text-xs">
                        <span className="flex items-center gap-1">
                          <Icon
                            icon="lucide:heart"
                            className="text-[10px]"
                          ></Icon>
                          {video.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon
                            icon="lucide:eye"
                            className="text-[10px]"
                          ></Icon>
                          {video.views}
                        </span>
                      </div>
                    </div>

                    {/* Top Badge */}
                    <div className="absolute top-2 right-2">
                      <span className="bg-[#D4AF37] text-[#800020] text-[10px] font-bold px-2 py-1 rounded-full">
                        {video.experience}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {/* Duplicate set for seamless loop */}
              {artisanVideos.map((video) => (
                <div
                  key={`second-${video.id}`}
                  className="group cursor-pointer flex-shrink-0"
                  onClick={() => openVideo(video.videoId)}
                >
                  <div className="relative w-[200px] aspect-[9/16] rounded-2xl overflow-hidden shadow-lg group-hover:shadow-2xl transition-all duration-300 group-hover:-translate-y-2 border-2 border-transparent group-hover:border-[#D4AF37]">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#800020] via-transparent to-transparent opacity-80"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-lg animate-pulse-slow">
                        <Icon
                          icon="lucide:play"
                          className="text-xl text-[#800020] ml-0.5"
                        ></Icon>
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="text-white font-bold text-sm mb-1 line-clamp-1">
                        {video.title}
                      </h3>
                      <p className="text-[#D4AF37] text-xs font-medium">
                        {video.artisan}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-white/80 text-xs">
                        <span className="flex items-center gap-1">
                          <Icon
                            icon="lucide:heart"
                            className="text-[10px]"
                          ></Icon>
                          {video.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon
                            icon="lucide:eye"
                            className="text-[10px]"
                          ></Icon>
                          {video.views}
                        </span>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className="bg-[#D4AF37] text-[#800020] text-[10px] font-bold px-2 py-1 rounded-full">
                        {video.experience}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Click Hint */}
          <div className="text-center mt-8">
            <p className="text-gray-500 text-sm flex items-center justify-center gap-2">
              <Icon
                icon="lucide:hand"
                className="animate-bounce"
              ></Icon>
              Click any video to watch full story
            </p>
          </div>
        </div>
      </section>

      {/* Video Info Section */}
      <section className="py-16 bg-[#F5F1E8]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold text-[#800020] mb-4">
            Watch Our Artists Create Magic
          </h3>
          <p className="text-gray-600 mb-6">
            These short videos show how we make beautiful Banarasi sarees by
            hand. Click any video to watch on YouTube.
          </p>
          <a
            href="https://www.youtube.com/@BanarasiKala"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#800020] text-[#D4AF37] font-bold rounded-full hover:bg-[#3D2817] transition-colors"
          >
            <Icon
              icon="lucide:youtube"
              className="text-xl"
            ></Icon>
            Subscribe to Our Channel
          </a>
        </div>
      </section>
    </div>
  );
};

export default Testimonials;

