"use client"

import {
  Toaster as ChakraToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  createToaster,
} from "@chakra-ui/react"

export const toaster = createToaster({
  placement: "top-end",
  duration: 2500,
})

export const Toaster = () => {
  return (
    <Portal>
      {/* 手机形态：toast 左右留白并避开状态栏，宽度撑满可用区（原样贴边且会被刘海压住） */}
      <ChakraToaster
        toaster={toaster}
        insetInline={{ base: "3", md: "4" }}
        css={{ paddingTop: 'var(--safe-top, 0px)' }}
      >
        {(toast) => (
          <Toast.Root width={{ base: "100%", md: "sm" }} flexDirection="row" onClick={() => toaster.dismiss(toast.id)} cursor="pointer">
            {toast.type === "loading" ? (
              <Spinner size="sm" color="blue.solid" />
            ) : (
              <Toast.Indicator />
            )}
            <Stack gap="1" flex="1" maxWidth="100%">
              {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
              {toast.description && (
                <Toast.Description>{toast.description}</Toast.Description>
              )}
            </Stack>
            {toast.action && (
              <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
            )}
            <Toast.CloseTrigger />
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  )
}
