import { createFileRoute } from '@tanstack/react-router'

import Me from '@components/mobile/Me'

export const Route = createFileRoute('/daily/_sidebar/me/')({
    component: Me,
})
