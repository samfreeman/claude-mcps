import type { NextConfig } from 'next'

const config: NextConfig = {
	outputFileTracingIncludes: {
		'/api/[transport]': ['./lib/wag/rituals/**/*']
	}
}

export default config
