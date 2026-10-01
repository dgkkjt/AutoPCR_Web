import * as React from "react"

import { Checkbox as ChakraCheckbox } from "@chakra-ui/react"

export interface CheckboxProps extends ChakraCheckbox.RootProps {
  icon?: React.ReactNode
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
  rootRef?: React.Ref<HTMLLabelElement>
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(props, ref) {
    const { icon, children, inputProps, rootRef, colorPalette = "brand", ...rest } = props
    return (
      // 触控基线：Root 是 label，整行可点；手机上把可点高度兜到 44px
      <ChakraCheckbox.Root
        ref={rootRef}
        colorPalette={colorPalette}
        minH={{ base: "44px", md: undefined }}
        {...rest}
      >
        <ChakraCheckbox.HiddenInput ref={ref} {...inputProps} />
        <ChakraCheckbox.Control>
          {icon || <ChakraCheckbox.Indicator />}
        </ChakraCheckbox.Control>
        {children != null && (
          <ChakraCheckbox.Label>{children}</ChakraCheckbox.Label>
        )}
      </ChakraCheckbox.Root>
    )
  },
)
