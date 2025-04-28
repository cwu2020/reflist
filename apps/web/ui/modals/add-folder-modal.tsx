import useWorkspace from "@/lib/swr/use-workspace";
import { FolderSummary } from "@/lib/types";
import { Button, Modal, TooltipContent, useKeyboardShortcut } from "@dub/ui";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { AddFolderForm } from "../folders/add-folder-form";

interface AddFolderModalProps {
  showModal: boolean;
  setShowModal: (showModal: boolean) => void;
  onSuccess?: (folder: FolderSummary) => void;
}

const AddFolderModal = ({
  showModal,
  setShowModal,
  onSuccess,
}: AddFolderModalProps) => {
  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <AddFolderForm
        onSuccess={(folder) => {
          onSuccess?.(folder);
          setShowModal(false);
        }}
        onCancel={() => setShowModal(false)}
      />
    </Modal>
  );
};

function AddFolderButton({
  setShowAddFolderModal,
}: {
  setShowAddFolderModal: Dispatch<SetStateAction<boolean>>;
}) {
  const { slug, plan } = useWorkspace();

  useKeyboardShortcut("c", () => setShowAddFolderModal(true), {
    enabled: true,
  });

  return (
    <Button
      text="Create folder"
      shortcut="C"
      onClick={() => setShowAddFolderModal(true)}
      className="h-9 w-fit rounded-lg"
      disabledTooltip={false}
    />
  );
}

export function useAddFolderModal({
  onSuccess,
}: { onSuccess?: (folder: FolderSummary) => void } = {}) {
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);

  const AddFolderModalCallback = useCallback(() => {
    return (
      <AddFolderModal
        showModal={showAddFolderModal}
        setShowModal={setShowAddFolderModal}
        onSuccess={onSuccess}
      />
    );
  }, [showAddFolderModal, setShowAddFolderModal]);

  const AddFolderButtonCallback = useCallback(() => {
    return <AddFolderButton setShowAddFolderModal={setShowAddFolderModal} />;
  }, [setShowAddFolderModal]);

  return useMemo(
    () => ({
      setShowAddFolderModal,
      AddFolderModal: AddFolderModalCallback,
      AddFolderButton: AddFolderButtonCallback,
    }),
    [setShowAddFolderModal, AddFolderModalCallback, AddFolderButtonCallback],
  );
}
