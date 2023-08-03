import imgIcon from "@/assets/icons/img.svg";
import lockIcon from "@/assets/icons/lock.svg";
import crossIcon from "@/assets/icons/cross.svg";
import Button from "@/components/BaseComponents/Button";
import Textarea from "@/components/BaseComponents/Textarea";
import { useAppDispatch, useSelector } from "@/state/hook";
import {
  // displayPostList,
  postSlice,
  // publishPost,
  uploadImg,
} from "@/state/post/slice";
import { privacySettingsSlice } from "@/state/privacySettings/slice";
import { addressAbbreviation, getAddressFromDid, uuid } from "@/utils";
import { useContext, useEffect, useMemo, useState } from "react";
import ImageUploading, { ImageListType } from "react-images-uploading";
import { css } from "styled-components";
import AccountStatus from "../AccountStatus";
import { FlexRow } from "../App/styled";
import PrivacySettings from "../PrivacySettings";
import {
  ButtonWrapper,
  Content,
  UploadImg,
  UploadImgCross,
  UploadImgWrapper,
  Wrapper,
} from "./styled";
import { Message } from "@arco-design/web-react";
import { IconArrowRight } from "@arco-design/web-react/icon";
import { CreateLensProfile } from "../CreateLensProfile";
// import { getLensProfiles } from "@/sdk/monetize";
import { lensProfileSlice } from "@/state/lensProfile/slice";
import { PostType } from "@/types";
import { identitySlice } from "@/state/identity/slice";
import { Context } from "@/context";
import { noExtensionSlice } from "@/state/noExtension/slice";
import {
  CreateStreamArgs,
  StreamType,
  useApp,
  useCreateStream,
  useFeeds,
  useProfiles,
  useStore,
} from "@dataverse/hooks";

interface PublishPostProps {
  isPending: boolean;
  createPublicStream: Function;
  createPayableStream: Function;
}

const PublishPost: React.FC<PublishPostProps> = ({
  isPending,
  createPublicStream,
  createPayableStream
}) => {
  const dispatch = useAppDispatch();
  const { modelParser } = useContext(Context);
  const { postModel, appVersion } = useContext(Context);
  const needEncrypt = useSelector((state) => state.privacySettings.needEncrypt);
  const settings = useSelector((state) => state.privacySettings.settings);
  const encryptedContent = useSelector((state) => state.post.encryptedContent);

  const isDataverseExtension = useSelector(
    (state) => state.noExtension.isDataverseExtension
  );

  const [content, setContent] = useState("");
  const [images, setImages] = useState<ImageListType>([]);
  const [postImages, setPostImages] = useState<string[]>([]);
  const { state } = useStore();
  const { connectApp } = useApp();
  const { getProfiles } = useProfiles();

  const onChange = (imageList: ImageListType, addUpdateIndex?: number[]) => {
    setImages(imageList);
  };

  const onError = (error: any) => {
    if (error?.maxNumber) {
      Message.info("Up to four pictures can be uploaded");
    }
  };

  const textareaOnChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.currentTarget.value);
  };

  const handleProfileAndPost = async () => {
    if (isPending) return;
    if (!state.address) return;

    const postImages = await handlePostImages();
    if (!postImages) return;

    // dispatch(postSlice.actions.setIsPublishingPost(true));

    let lensProfiles: any[] = [];
    if (needEncrypt) {
      lensProfiles = await getProfiles(state.address);

      if (lensProfiles.length === 0) {
        // dispatch(postSlice.actions.setIsPublishingPost(false));
        dispatch(lensProfileSlice.actions.setModalVisible(true));
        return;
      }
      await post({
        postImages,
        profileId: lensProfiles[0],
      });
    } else {
      await post({
        postImages,
      });
    }
  };

  const handlePostImages = async () => {
    if (needEncrypt) {
      const amountReg = new RegExp("^([0-9][0-9]*)+(.[0-9]{1,17})?$");
      const { amount, collectLimit } = settings;
      const isValid =
        amount &&
        collectLimit &&
        amountReg.test(String(amount)) &&
        amount > 0 &&
        collectLimit > 0;
      if (!isValid) {
        Message.info("Incorrect privacy settings!");
        return;
      }
    }
    const files: File[] = [];
    images.map((image) => {
      if (image.file) {
        files.push(image.file);
      }
    });
    const postImages = (await (
      await dispatch(uploadImg({ files }))
    ).payload) as string[];

    if (!content && postImages.length === 0) {
      Message.info("Text and pictures cannot both be empty.");
      return;
    }

    setPostImages(postImages);
    return postImages;
  };

  const post = async ({
    profileId,
    postImages,
  }: {
    profileId?: string;
    postImages: string[];
  }) => {
    if (!isDataverseExtension) {
      dispatch(noExtensionSlice.actions.setModalVisible(true));
      // dispatch(postSlice.actions.setIsPublishingPost(false));
      return;
    }
    if (!state.pkh) {
      try {
        // dispatch(identitySlice.actions.setIsConnectingIdentity(true));
        await connectApp({ appId: modelParser.appId });
        // dispatch(identitySlice.actions.setPkh(pkh));
      } catch (error) {
        console.error(error);
        return;
      } finally {
        // dispatch(identitySlice.actions.setIsConnectingIdentity(false));
      }
    }
    try {
      let res;
      const date = new Date().toISOString();
      console.log("Before create stream, settings:", settings);
      switch (settings.postType) {
        case PostType.Public:
          res = await createPublicStream({
            modelId: postModel.streams[postModel.streams.length - 1].modelId,
            stream: {
              appVersion,
              profileId,
              text: content,
              images: postImages,
              videos: [],
              createdAt: date,
              updatedAt: date,
            },
          });
          console.log(
            "[Branch PostType.Public]: After createPublicStream, res:",
            res
          );
          break;
        case PostType.Encrypted:
          break;
        case PostType.Payable:
          res = await createPayableStream({
            modelId: postModel.streams[postModel.streams.length - 1].modelId,
            profileId,
            stream: {
              appVersion,
              text: content,
              images: postImages,
              videos: [],
              createdAt: date,
              updatedAt: date,
            },
            currency: settings.currency!,
            amount: settings.amount!,
            collectLimit: settings.collectLimit!,
            encrypted: {
              text: true,
              images: true,
              videos: false,
            },
          });
          console.log(
            "[Branch PostType.Payable]: After createPayableStream, res:",
            res
          );
          break;
      }
      Message.success({
        content: (
          <>
            Post successfully!
            <a
              href={`${process.env.DATAVERSE_OS}/finder`}
              target="_blank"
              style={{ marginLeft: "5px", color: "black" }}
            >
              <span style={{ textDecoration: "underline" }}>
                View on DataverseOS File System
              </span>
              <IconArrowRight
                style={{
                  color: "black",
                  transform: "rotate(-45deg)",
                }}
              />
            </a>
          </>
        ),
      });
      setContent("");
      setImages([]);
    } catch (error: any) {
      Message.error(error?.message ?? error);
    }
  };

  const openPrivacySettings = () => {
    dispatch(privacySettingsSlice.actions.setModalVisible(true));
  };

  return (
    <Wrapper>
      <Content>
        <ImageUploading
          multiple
          maxNumber={4}
          value={images}
          onChange={onChange}
          onError={onError}
          dataURLKey="upload"
        >
          {({
            imageList,
            onImageUpload,
            onImageRemoveAll,
            onImageUpdate,
            onImageRemove,
            isDragging,
            dragProps,
          }) => (
            <>
              <AccountStatus
                name={addressAbbreviation(state.address) ?? ""}
                cssStyles={css`
                  margin-bottom: 1rem;
                `}
                did={state.pkh || ""}
              />
              <Textarea
                value={encryptedContent || content}
                placeholder="what's happening?"
                onChange={textareaOnChange}
                width={"100%"}
                height={147}
              />
              <FlexRow>
                {imageList.map((image, index) => (
                  <UploadImgWrapper key={uuid()}>
                    <UploadImgCross
                      src={crossIcon}
                      onClick={() => {
                        onImageRemove(index);
                      }}
                    />
                    <UploadImg
                      src={image["upload"]}
                      onClick={() => {
                        onImageUpdate(index);
                      }}
                    />
                  </UploadImgWrapper>
                ))}
              </FlexRow>
              <ButtonWrapper>
                <FlexRow>
                  <Button type="icon" width={"1.75rem"} onClick={onImageUpload}>
                    <img src={imgIcon} />
                  </Button>
                  <Button
                    type="icon"
                    width={"1.75rem"}
                    css={css`
                      margin-left: 26px;
                    `}
                    onClick={openPrivacySettings}
                  >
                    <img src={lockIcon} />
                  </Button>
                </FlexRow>
                <FlexRow>
                  <Button
                    type="primary"
                    loading={isPending}
                    onClick={handleProfileAndPost}
                    width={110}
                    css={css`
                      border-radius: 8px;
                      padding: 0.3rem 2rem;
                    `}
                  >
                    Post
                  </Button>
                </FlexRow>
              </ButtonWrapper>
            </>
          )}
        </ImageUploading>
      </Content>
      <PrivacySettings />
      <CreateLensProfile />
    </Wrapper>
  );
};

export default PublishPost;
