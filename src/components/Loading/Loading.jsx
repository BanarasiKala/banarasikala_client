
const Loading = ({ message = 'Loading...' }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F1E8]">
      <div className="text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 border-4 border-[#D4AF37]/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#800020] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="serif-text italic text-xl text-[#800020] animate-pulse">
          {message}
        </p>
      </div>
    </div>
  );
};

export default Loading;
