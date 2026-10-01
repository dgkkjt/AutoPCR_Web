import { Button, ButtonProps } from "@chakra-ui/react"

import { forwardRef } from "react"

export interface IconButtonProps extends ButtonProps {
  "aria-label": string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(props, ref) {
    // 触控基线：手机上无论视觉 size 多小（xs/sm 只有 24~28px），热区一律兜到 44×44。
    // 桌面（md+）保持原尺寸，视觉与布局不变。
    return (
      <Button
        padding={0}
        minW={{ base: "44px", md: undefined }}
        minH={{ base: "44px", md: undefined }}
        ref={ref}
        {...props}
      />
    )
  }
)
