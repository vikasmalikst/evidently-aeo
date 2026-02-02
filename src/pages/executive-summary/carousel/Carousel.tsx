import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselProps {
    children: React.ReactNode[];
    autoPlay?: boolean;
    interval?: number;
}

export const Carousel: React.FC<CarouselProps> = ({ children, autoPlay = false, interval = 5000 }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0);

    const slides = React.Children.toArray(children);

    useEffect(() => {
        if (!autoPlay) return;
        const timer = setInterval(() => {
            nextSlide();
        }, interval);
        return () => clearInterval(timer);
    }, [currentIndex, autoPlay, interval]);

    const nextSlide = () => {
        setDirection(1);
        setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    };

    const prevSlide = () => {
        setDirection(-1);
        setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    };

    const goToSlide = (index: number) => {
        setDirection(index > currentIndex ? 1 : -1);
        setCurrentIndex(index);
    };

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 1000 : -1000,
            opacity: 0
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 1000 : -1000,
            opacity: 0
        })
    };

    return (
        <div className="relative w-full overflow-hidden bg-white rounded-xl shadow-sm border border-gray-100 h-[600px] flex flex-col">
            <div className="flex-1 relative overflow-hidden">
                <AnimatePresence initial={false} custom={direction} mode='wait'>
                    <motion.div
                        key={currentIndex}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            x: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 }
                        }}
                        className="absolute inset-0 w-full h-full p-8"
                    >
                        {slides[currentIndex]}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Controls */}
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none z-20">
                <button
                    onClick={prevSlide}
                    className="p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-md text-gray-800 hover:bg-white hover:text-blue-600 transition-all pointer-events-auto border border-gray-200"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none z-20">
                <button
                    onClick={nextSlide}
                    className="p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-md text-gray-800 hover:bg-white hover:text-blue-600 transition-all pointer-events-auto border border-gray-200"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>
            </div>

            {/* Dots */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-2 z-20">
                {slides.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => goToSlide(index)}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${currentIndex === index
                            ? 'bg-blue-600 w-8'
                            : 'bg-gray-300 hover:bg-gray-400'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
};
