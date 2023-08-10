import AccountStatus from "@/components/AccountStatus";
import { addressAbbreviation, getAddressFromDid, timeAgo } from "@/utils";
import { PropsWithRef, useEffect, useMemo, useState } from "react";
import { Chain, FileType, WALLET } from "@dataverse/dataverse-connector";
import { Wrapper, Content, CreatedAt } from "./styled";
import React from "react";
import Text from "./Text";
import Images from "./Images";
import UnlockInfo from "./UnlockInfo";
import { Header } from "./styled";
import { FlexRow } from "@/styled";
import {
  MutationStatus,
  useAction,
  useDatatokenInfo,
  useStore,
  useUnlockStream,
} from "@dataverse/hooks";
import { usePlaygroundStore } from "@/context";
import { Message } from "@arco-design/web-react";

interface DisplayPostItemProps extends PropsWithRef<any> {
  streamId: string;
  connectApp?: (args?: {
    wallet?: WALLET | undefined;
    provider?: any;
  }) => Promise<{
    pkh: string;
    address: string;
    chain: Chain;
    wallet: WALLET;
  }>;
}

const DisplayPostItem: React.FC<DisplayPostItemProps> = ({
  streamId,
  connectApp,
}) => {
  // const navigate = useNavigate();

  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);

  const { browserStorage } = usePlaygroundStore();

  const { actionUpdateDatatokenInfo, actionUpdateStream } = useAction();

  const { isDataverseExtension, setNoExtensionModalVisible } =
    usePlaygroundStore();
  const { pkh, streamsMap } = useStore();
  const streamRecord = useMemo(() => {
    return streamsMap![streamId];
  }, [streamsMap]);

  const { isPending: isGettingDatatokenInfo, getDatatokenInfo } =
    useDatatokenInfo({
      onSuccess: result => {
        if (!browserStorage?.getDatatokenInfo(streamId)) {
          browserStorage?.setDatatokenInfo({ streamId, datatokenInfo: result });
        }
      },
    });

  const {
    isSucceed: isUnlockSucceed,
    setStatus: setUnlockStatus,
    unlockStream,
  } = useUnlockStream({
    onError: (error: any) => {
      console.error(error);
      Message.error(error?.message ?? error);
    },
    onSuccess: result => {
      if (!browserStorage?.getDecryptedStreamContent(streamId)) {
        browserStorage?.setDecryptedStreamContent({
          streamId,
          ...result,
        });
      }
    },
  });

  useEffect(() => {
    if (
      !isGettingDatatokenInfo &&
      streamRecord.streamContent.file.fileType === FileType.Datatoken &&
      !streamRecord.datatokenInfo
    ) {
      const datatokenInfo = browserStorage?.getDatatokenInfo(streamId);
      if (datatokenInfo) {
        actionUpdateDatatokenInfo({
          streamId,
          datatokenInfo,
        });
      } else {
        getDatatokenInfo(streamId);
      }
    }

    if (
      browserStorage &&
      isDataverseExtension &&
      !isUnlocking &&
      !isUnlockSucceed &&
      streamRecord.streamContent.file.fileType !== FileType.Public
    ) {
      const streamContent = browserStorage.getDecryptedStreamContent(streamId);

      if (streamContent) {
        actionUpdateStream({ streamId, streamContent });
        setUnlockStatus(MutationStatus.Succeed);
      }
    }
  }, [browserStorage, streamsMap]);

  const unlock = async () => {
    setIsUnlocking(true);
    try {
      if (isDataverseExtension === false) {
        setNoExtensionModalVisible(true);
        return;
      }

      if (!pkh) {
        await connectApp!();
      }

      if (isUnlocking) {
        throw new Error("cannot unlock");
      }

      await unlockStream(streamId);
    } catch (error) {
      console.error(error);
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <Wrapper>
      <Content>
        <Header>
          <FlexRow>
            <AccountStatus
              name={
                addressAbbreviation(getAddressFromDid(streamRecord.pkh)) ?? ""
              }
              did={streamRecord.pkh}
            />
            <CreatedAt>
              {"• " +
                timeAgo(
                  Date.parse(streamRecord.streamContent.content.createdAt),
                )}
            </CreatedAt>
          </FlexRow>
          {streamRecord.streamContent.file.fileType !== FileType.Public && (
            <UnlockInfo
              streamRecord={streamRecord}
              isPending={isUnlocking}
              isSucceed={isUnlockSucceed}
              unlock={unlock}
            />
          )}
        </Header>

        <Text
          streamRecord={streamRecord}
          isUnlockSucceed={isUnlockSucceed}
          onClick={() => {
            // navigate("/post/" + streamRecord.streamId);
          }}
        />
        <Images
          streamRecord={streamRecord}
          isUnlockSucceed={isUnlockSucceed}
          isGettingDatatokenInfo={isGettingDatatokenInfo}
          onClick={() => {
            // navigate("/post/" + streamRecord.streamId);
          }}
        />
        {/* <Footer>
          <a
            href={`${process.env.DATAVERSE_OS}/finder`}
            target="_blank"
            className="link"
          >
            View on DataverseOS File System
          </a>
        </Footer> */}
      </Content>
    </Wrapper>
  );
};

export default DisplayPostItem;
