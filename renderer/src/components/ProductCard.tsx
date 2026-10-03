import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core'
import type { MouseEvent } from 'react'
import { formatKr } from '../basket'
import type { Product } from '../xapp'
import classes from './ProductCard.module.css'

const LEFT_BUTTON = 0
const RIGHT_BUTTON = 2

interface ProductCardProps {
  product: Product
  count: number
  onAdd: () => void
  onRemove: () => void
}

// Left click adds one, right click removes one.
export function ProductCard({
  product,
  count,
  onAdd,
  onRemove,
}: ProductCardProps) {
  function handleMouseDown(event: MouseEvent) {
    if (event.button === LEFT_BUTTON) onAdd()
    if (event.button === RIGHT_BUTTON) onRemove()
  }

  return (
    <CardFrame
      product={product}
      price={formatKr(product.price)}
      badge={count > 0 ? String(count) : null}
      onMouseDown={handleMouseDown}
    >
      <ProductInfo product={product} />
    </CardFrame>
  )
}

interface FreeAmountCardProps {
  product: Product
  // The confirmed amount in kr, or 0.
  amount: number
  numpadOpen: boolean
  numpadAmount: number
  onOpen: () => void
  onChange: (delta: number) => void
  onConfirm: () => void
  onDelete: () => void
}

// X-BELOP: left click opens a numpad with +5 and +10 (right click subtracts).
// OK adds the amount to the basket, Slett removes it. Right click on the
// closed card also removes it.
export function FreeAmountCard({
  product,
  amount,
  numpadOpen,
  numpadAmount,
  onOpen,
  onChange,
  onConfirm,
  onDelete,
}: FreeAmountCardProps) {
  function handleCardMouseDown(event: MouseEvent) {
    if (numpadOpen) return
    if (event.button === LEFT_BUTTON) onOpen()
    if (event.button === RIGHT_BUTTON) onDelete()
  }

  function step(value: number) {
    return (event: MouseEvent) => {
      event.stopPropagation()
      if (event.button === LEFT_BUTTON) onChange(value)
      if (event.button === RIGHT_BUTTON && numpadAmount >= value) {
        onChange(-value)
      }
    }
  }

  const shownAmount = numpadOpen ? numpadAmount : amount
  const price = numpadOpen || amount > 0 ? formatKr(shownAmount) : '_____ kr'

  return (
    <CardFrame
      product={product}
      price={price}
      badge={amount > 0 ? 'Aktiv' : null}
      numpadOpen={numpadOpen}
      onMouseDown={handleCardMouseDown}
    >
      {numpadOpen ? (
        <Stack gap="xs" onMouseDown={event => event.stopPropagation()}>
          <Group grow gap="xs">
            {[5, 10].map(value => (
              <Button
                key={value}
                data-testid={`numpad-plus-${value}`}
                variant="outline"
                color="gray.0"
                size="lg"
                onMouseDown={step(value)}
              >
                +{value}
              </Button>
            ))}
          </Group>
          <Group grow gap="xs">
            <Button
              data-testid="numpad-delete"
              color="yellow"
              onClick={onDelete}
            >
              Slett
            </Button>
            <Button
              data-testid="numpad-ok"
              color="blue"
              disabled={numpadAmount <= 0}
              onClick={onConfirm}
            >
              OK
            </Button>
          </Group>
        </Stack>
      ) : (
        <ProductInfo product={product} />
      )}
    </CardFrame>
  )
}

interface CardFrameProps {
  product: Product
  price: string
  badge: string | null
  numpadOpen?: boolean
  onMouseDown: (event: MouseEvent) => void
  children: React.ReactNode
}

function CardFrame({
  product,
  price,
  badge,
  numpadOpen = false,
  onMouseDown,
  children,
}: CardFrameProps) {
  return (
    <Card
      data-testid="product-card"
      data-sku={product.sku_number}
      data-numpad-open={numpadOpen || undefined}
      className={classes.card}
      withBorder
      padding="md"
      onMouseDown={onMouseDown}
      onContextMenu={event => event.preventDefault()}
    >
      <Card.Section
        withBorder
        inheritPadding
        py="xs"
        className={classes.header}
      >
        <span>{product.icon}</span>
        <Text data-testid="product-price" fw={600} size="lg">
          {price}
        </Text>
      </Card.Section>
      {badge && (
        <Badge data-testid="product-badge" size="xl" className={classes.badge}>
          {badge}
        </Badge>
      )}
      <Stack pt="sm" gap={4}>
        {children}
      </Stack>
    </Card>
  )
}

function ProductInfo({ product }: { product: Product }) {
  return (
    <>
      <Text fw={700} size="xl">
        {product.name}
      </Text>
      <Text c="dimmed" size="sm">
        {product.description}
      </Text>
    </>
  )
}
