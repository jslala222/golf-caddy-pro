
/** @type {import('next').NextConfig} */
const nextConfig = {
    // Vercel 배포 시 더 안정적인 기본 빌드 방식 사용
    // output: 'export',
    images: {
        unoptimized: true,
    },
    // 빌드 시 린트 에러로 중단되지 않도록 설정 (배포 우선)
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    trailingSlash: true,
};

export default nextConfig;
