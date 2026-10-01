import {
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalHeader,
    ModalOverlay,
} from '../../components/ui/modal'
import NiceModal, { useModal } from "@ebay/nice-modal-react";

import {
    Image,
} from '@chakra-ui/react'
import announcement from "@/assets/announcement.png"

const ReadmeModal = NiceModal.create(() => {
    const modal = useModal();
    return (
        <Modal blockScrollOnMount={false} size='lg' placement="center" closeOnOverlayClick={false} isOpen={modal.visible} onClose={async () => { modal.resolve(); await modal.hide(); }}>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>使用须知</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    {/* 这张图 1264×674 有 263KB（比全站 JS 传输量还大 87%），而本弹窗在首次访问时自动打开，
                        正好卡在首屏加载窗口。至少让它的解码不阻塞首帧：decoding=async 异步解码。
                        进一步的体积优化（压到 WebP / 缩小尺寸）会改动资源文件，见方案文档的确认项。 */}
                    <Image
                        src={announcement}
                        alt="announcement"
                        w="full"
                        h="auto"
                        maxH="60vh"
                        objectFit="contain"
                        decoding="async"
                    />
                </ModalBody>
            </ModalContent>
        </Modal>
    )
})

export default ReadmeModal;
