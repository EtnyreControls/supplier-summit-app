'use client';

import { useRef, useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CachedRoundedIcon from '@mui/icons-material/CachedRounded';

interface Brand {
  name: string;
  logo: string; // placeholder: road image, swap per-brand later
  href: string; // placeholder link, swap per-brand later
}

interface BusinessUnit {
  id: string;
  name: string;
  hexImage: string; // placeholder: road image, swap per-brand later
  members: number;
  funFact: string;
  brands: Brand[];
}

const BUSINESS_UNITS: BusinessUnit[] = [
  {
    id: 'road-maintenance',
    name: 'Road Maintenance & Transportation',
    hexImage: '/Unit_1.png',
    members: 550,
    funFact: 'Building equipment since 1898—five years before the windshield wiper was patented!',
    brands: [
      { name: 'E.D. Etnyre & Co.', logo: '/etnyre-logo.png', href: 'https://etnyre.com/' },
      { name: 'BearCat Manufacturing', logo: '/bearcat-logo.png', href: 'https://bearcatmfg.com/' },
    ],
  },
  {
    id: 'heavy-metal-fab',
    name: 'Heavy Metal Fabrication',
    hexImage: '/Unit_2.png',
    members: 310,
    funFact: 'Grew from one facility to four football fields of manufacturing space since 1972!',
    brands: [{ name: 'SMF', logo: '/smf-logo.png', href: 'https://smf-inc.com/' }],
  },
  {
    id: 'perforated-metal',
    name: 'Perforated Metal & Screen Solutions',
    hexImage: '/Unit_3.png',
    members: 190,
    funFact: 'Pioneered commercial perforated metal in 1876!',
    brands: [
      { name: 'Hendrick Manufacturing', logo: '/hendrick-logo.png', href: 'https://www.hendrickcorp.com/' },
    ],
  },
];

const HEX_CLIP = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';

function UnitCardFace({
  unit,
  showBrands,
}: {
  unit: BusinessUnit;
  showBrands: boolean;
}) {
  return (
    <Box
      className="summit-flip-card-back"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        px: 3,
        bgcolor: 'var(--color-grey-50)',
        clipPath: HEX_CLIP,
      }}
    >
      <Typography sx={{ color: 'var(--color-ink)', fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
        {unit.members}
      </Typography>
      <Typography sx={{ color: 'var(--color-ink)', fontSize: 13, mb: 1 }}>
        members
      </Typography>

      <Typography
        sx={{
          color: 'var(--color-ink)',
          fontSize: 11.5,
          textAlign: 'center',
          lineHeight: 1.35,
          px: 1,
          mb: showBrands ? 1 : 0,
        }}
      >
        {unit.funFact}
      </Typography>

      {showBrands && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
          {unit.brands.map((brand) => (
            <Box
              key={brand.name}
              component="a"
              href={brand.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                textDecoration: 'none',
                color: 'var(--color-ink)',
                fontSize: 12.5,
                '&:hover': { color: '#FFED00' },
              }}
            >
              <Box
                component="img"
                src={brand.logo}
                alt={`${brand.name} logo`}
                sx={{ width: 48, height: 48, objectFit: 'contain' }}
              />
              {brand.name}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function FlipCard({ unit, showBrandsOnBack }: { unit: BusinessUnit; showBrandsOnBack: boolean }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <Box
        onClick={() => setFlipped((f) => !f)}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={`${unit.name}, tap to ${flipped ? 'show summary' : 'show details'}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        className={`summit-flip-card animate-summit-fade${flipped ? ' is-flipped' : ''}`}
        sx={{
          // flat-top hexagon aspect ratio ~1.157:1, matching source artwork
          width: { xs: 264, md: 312 },
          height: { xs: 228, md: 270 },
          cursor: 'pointer',
        }}
      >
        <div className="summit-flip-card-inner">
          {/* front */}
          <Box
            component="img"
            src={unit.hexImage}
            alt={unit.name}
            className="summit-flip-card-front"
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {/* back */}
          <UnitCardFace unit={unit} showBrands={showBrandsOnBack} />
        </div>
      </Box>

      <Typography
        sx={{
          mt: 2,
          color: 'var(--ink)',
          fontWeight: 500,
          fontSize: 15,
          textAlign: 'center',
          lineHeight: 1.4,
          maxWidth: { xs: 220, md: 260 },
        }}
      >
        {unit.name}
      </Typography>
      {/* Signage that this card flips — same "tap/click to reveal" cue as
          the Mission/Vision hexagons' "↻ tap" hint, placed below the name
          rather than overlaid on the hexagon itself. */}
      <Box
        sx={{
          mt: 0.75,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          color: 'var(--color-grey-500)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        <CachedRoundedIcon sx={{ fontSize: 12 }} />
        Tap to flip
      </Box>
    </Box>
  );
}

export function BusinessUnits() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const cardWidth = 220 + 16; // card + gap, xs size
    const index = Math.round(track.scrollLeft / cardWidth);
    setActiveIndex(index);
  };

  const scrollToIndex = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const cardWidth = 220 + 16;
    track.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
  };

  return (
    <Box component="section" sx={{ py: { xs: 6, md: 10 } }}>
      <Typography
        variant="h2"
        sx={{
          textAlign: 'center',
          mb: { xs: 4, md: 6 },
          color: 'var(--ink)',
        }}
      >
        Business Units
      </Typography>

      {/* Mobile: swipeable carousel, flip, no brand logos */}
      <Box
        sx={{
          display: { xs: 'block', md: 'none' },
        }}
      >
        <Box
          ref={trackRef}
          onScroll={handleScroll}
          sx={{
            display: 'flex',
            gap: 2,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            px: 2,
            pb: 1,
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          {BUSINESS_UNITS.map((unit) => (
            <Box key={unit.id} sx={{ scrollSnapAlign: 'center' }}>
              <FlipCard unit={unit} showBrandsOnBack={false} />
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mt: 2 }}>
          <IconButton
            aria-label="Previous business unit"
            onClick={() => scrollToIndex(Math.max(activeIndex - 1, 0))}
            disabled={activeIndex === 0}
            size="small"
            sx={{
              color: 'var(--ink)',
              border: '1px solid var(--grey-600)',
              '&.Mui-disabled': { opacity: 0.35 },
            }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {BUSINESS_UNITS.map((unit, i) => (
              <Box
                key={unit.id}
                component="button"
                aria-label={`Go to ${unit.name}`}
                onClick={() => scrollToIndex(i)}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  border: 'none',
                  p: 0,
                  bgcolor: i === activeIndex ? 'var(--yellow)' : 'var(--grey-600)',
                  cursor: 'pointer',
                }}
              />
            ))}
          </Box>

          <IconButton
            aria-label="Next business unit"
            onClick={() => scrollToIndex(Math.min(activeIndex + 1, BUSINESS_UNITS.length - 1))}
            disabled={activeIndex === BUSINESS_UNITS.length - 1}
            size="small"
            sx={{
              color: 'var(--ink)',
              border: '1px solid var(--grey-600)',
              '&.Mui-disabled': { opacity: 0.35 },
            }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Desktop: single row, click to flip, brand logos on back */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          justifyContent: 'center',
          gap: 4,
        }}
      >
        {BUSINESS_UNITS.map((unit) => (
          <FlipCard key={unit.id} unit={unit} showBrandsOnBack />
        ))}
      </Box>
    </Box>
  );
}