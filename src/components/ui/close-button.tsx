import * as React from "react"

import type { ButtonProps } from "@chakra-ui/react"
import { IconButton as ChakraIconButton } from "@chakra-ui/react"
import { LuX } from "react-icons/lu"

export interface CloseButtonProps extends ButtonProps {}

export const CloseButton = React.forwardRef<HTMLButtonElement, CloseButtonProps>(
  function CloseButton(props, ref) {
    return (
      // 触控基线：手机上关闭按钮热区兜到 44×44（删除类操作误触代价高）
      <ChakraIconButton
        variant="ghost"
        aria-label="Close"
        minW={{ base: "44px", md: undefined }}
        minH={{ base: "44px", md: undefined }}
        ref={ref}
        {...props}
      >
        {props.children ?? <LuX />}
      </ChakraIconButton>
    )
  },
)
