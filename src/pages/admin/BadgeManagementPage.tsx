import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import {
  ArrowLeft,
  Badge,
  Download,
  Link as LinkIcon,
  Loader2,
  Save,
  Settings,
} from "lucide-react";
import toast from "react-hot-toast";

import { db } from "../../firebase";
import { useConference } from "../../hooks/useConference";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import BadgeTemplate from "../../components/print/BadgeTemplate";
import { convertBadgeLayoutToConfig } from "../../utils/badgeConverter";

type BadgeMenuVisibility = {
  status?: boolean;
  sessions?: boolean;
  materials?: boolean;
  program?: boolean;
  translation?: boolean;
  stampTour?: boolean;
  home?: boolean;
  qna?: boolean;
  certificate?: boolean;
};

type BadgeMenuLabel = {
  ko?: string;
  en?: string;
};

type BadgeMenuLabels = {
  status?: BadgeMenuLabel;
  sessions?: BadgeMenuLabel;
  materials?: BadgeMenuLabel;
  program?: BadgeMenuLabel;
  translation?: BadgeMenuLabel;
  stampTour?: BadgeMenuLabel;
  home?: BadgeMenuLabel;
  qna?: BadgeMenuLabel;
  certificate?: BadgeMenuLabel;
};

const BadgeManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { cid } = useParams<{ cid: string }>();
  const { info } = useConference(cid);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [materialsUrls, setMaterialsUrls] = useState<
    { name: string; url: string }[]
  >([]);
  const [translationUrl, setTranslationUrl] = useState("");
  const [menuVisibility, setMenuVisibility] = useState<Required<BadgeMenuVisibility>>({
    status: true,
    sessions: true,
    materials: true,
    program: true,
    translation: true,
    stampTour: true,
    home: true,
    qna: true,
    certificate: true,
  });
  const [menuLabels, setMenuLabels] = useState<Required<BadgeMenuLabels>>({
    status: { ko: "상태", en: "Status" },
    sessions: { ko: "수강", en: "Sessions" },
    materials: { ko: "자료", en: "Materials" },
    program: { ko: "일정", en: "Program" },
    translation: { ko: "번역", en: "Translation" },
    stampTour: { ko: "메뉴", en: "Menu" },
    home: { ko: "학술대회 홈페이지로 이동", en: "Conference Home" },
    qna: { ko: "Q&A", en: "Q&A" },
    certificate: { ko: "참가확인서", en: "Certificate" },
  });
  const [badgeLayoutEnabled, setBadgeLayoutEnabled] = useState(false);

  useEffect(() => {
    if (!cid) return;

    const fetchSettings = async () => {
      try {
        const badgeConfigSnap = await getDoc(
          doc(db, `conferences/${cid}/settings`, "badge_config"),
        );

        if (badgeConfigSnap.exists()) {
          const data = badgeConfigSnap.data() as {
            materialsUrls?: { name: string; url: string }[];
            translationUrl?: string;
            menuVisibility?: BadgeMenuVisibility;
            menuLabels?: BadgeMenuLabels;
            badgeLayoutEnabled?: boolean;
          };
          setMaterialsUrls(data.materialsUrls || []);
          setTranslationUrl(data.translationUrl || "");
          setMenuVisibility({
            status: data.menuVisibility?.status ?? true,
            sessions: data.menuVisibility?.sessions ?? true,
            materials: data.menuVisibility?.materials ?? true,
            program: data.menuVisibility?.program ?? true,
            translation:
              data.menuVisibility?.translation ??
              (data.translationUrl ? data.translationUrl !== "HIDE" : true),
            stampTour: data.menuVisibility?.stampTour ?? true,
            home: data.menuVisibility?.home ?? true,
            qna: data.menuVisibility?.qna ?? true,
            certificate: data.menuVisibility?.certificate ?? true,
          });
          setMenuLabels({
            status: {
              ko: data.menuLabels?.status?.ko ?? "상태",
              en: data.menuLabels?.status?.en ?? "Status",
            },
            sessions: {
              ko: data.menuLabels?.sessions?.ko ?? "수강",
              en: data.menuLabels?.sessions?.en ?? "Sessions",
            },
            materials: {
              ko: data.menuLabels?.materials?.ko ?? "자료",
              en: data.menuLabels?.materials?.en ?? "Materials",
            },
            program: {
              ko: data.menuLabels?.program?.ko ?? "일정",
              en: data.menuLabels?.program?.en ?? "Program",
            },
            translation: {
              ko: data.menuLabels?.translation?.ko ?? "번역",
              en: data.menuLabels?.translation?.en ?? "Translation",
            },
            stampTour: {
              ko: data.menuLabels?.stampTour?.ko ?? "메뉴",
              en: data.menuLabels?.stampTour?.en ?? "Menu",
            },
            home: {
              ko: data.menuLabels?.home?.ko ?? "학술대회 홈페이지로 이동",
              en: data.menuLabels?.home?.en ?? "Conference Home",
            },
            qna: {
              ko: data.menuLabels?.qna?.ko ?? "Q&A",
              en: data.menuLabels?.qna?.en ?? "Q&A",
            },
            certificate: {
              ko: data.menuLabels?.certificate?.ko ?? "참가확인서",
              en: data.menuLabels?.certificate?.en ?? "Certificate",
            },
          });
          setBadgeLayoutEnabled(data.badgeLayoutEnabled || false);
        }
      } catch (error) {
        console.error("Failed to fetch badge settings:", error);
        toast.error("명찰 설정을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [cid]);

  const handleSave = async () => {
    if (!cid) return;

    setSaving(true);
    try {
      await setDoc(
        doc(db, `conferences/${cid}/settings`, "badge_config"),
        {
          materialsUrls,
          translationUrl,
          menuVisibility,
          menuLabels,
          badgeLayoutEnabled,
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );

      toast.success("명찰 설정이 저장되었습니다.");
    } catch (error) {
      console.error("Failed to save badge settings:", error);
      toast.error("명찰 설정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const addMaterialUrl = () => {
    setMaterialsUrls([...materialsUrls, { name: "", url: "" }]);
  };

  const updateMaterialUrl = (
    index: number,
    field: "name" | "url",
    value: string,
  ) => {
    const next = [...materialsUrls];
    next[index][field] = value;
    setMaterialsUrls(next);
  };

  const removeMaterialUrl = (index: number) => {
    setMaterialsUrls(
      materialsUrls.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            뒤로가기
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">명찰 관리</h1>
          <p className="mt-2 text-gray-600">
            디지털 명찰 및 출력 명찰의 레이아웃과 노출 메뉴를 관리합니다.
          </p>
        </div>

        <Tabs defaultValue="digital" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="digital">
              <Badge className="mr-2 h-4 w-4" />
              디지털 명찰
            </TabsTrigger>
            <TabsTrigger value="print">
              <Download className="mr-2 h-4 w-4" />
              출력 명찰
            </TabsTrigger>
          </TabsList>

          <TabsContent value="digital">
            <Card>
              <CardHeader>
                <CardTitle>디지털 명찰 설정</CardTitle>
                <CardDescription>
                  자료 다운로드 링크와 번역 서비스 링크를 관리합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      자료 다운로드 링크
                    </Label>
                    <Button
                      onClick={addMaterialUrl}
                      size="sm"
                      variant="outline"
                    >
                      <LinkIcon className="mr-1 h-4 w-4" />
                      링크 추가
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500">
                    디지털 명찰의 자료 탭에 노출할 다운로드 링크입니다.
                  </p>

                  {materialsUrls.map((material, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="링크 이름"
                          value={material.name}
                          onChange={(event) =>
                            updateMaterialUrl(index, "name", event.target.value)
                          }
                        />
                        <Input
                          placeholder="URL (https://...)"
                          value={material.url}
                          onChange={(event) =>
                            updateMaterialUrl(index, "url", event.target.value)
                          }
                        />
                      </div>
                      <Button
                        onClick={() => removeMaterialUrl(index)}
                        variant="destructive"
                        size="sm"
                        className="mt-6"
                      >
                        삭제
                      </Button>
                    </div>
                  ))}

                  {materialsUrls.length === 0 && (
                    <div className="rounded-lg border-2 border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                      등록된 링크가 없습니다.
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base font-semibold">
                        실시간 번역 탭 사용
                      </Label>
                      <p className="text-sm text-gray-500">
                        디지털 명찰에 실시간 번역 서비스 탭을 노출합니다.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={translationUrl !== "HIDE"}
                      onChange={(event) =>
                        setTranslationUrl(event.target.checked ? "" : "HIDE")
                      }
                      className="h-5 w-5 rounded text-blue-600"
                    />
                  </div>

                  {translationUrl !== "HIDE" && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
                      <Label className="text-sm font-semibold">
                        외부 번역 링크 연결 (선택)
                      </Label>
                      <Input
                        placeholder="https://translation-service.example.com/..."
                        value={translationUrl === "HIDE" ? "" : (translationUrl || "")}
                        onChange={(event) =>
                          setTranslationUrl(event.target.value)
                        }
                      />
                      <p className="text-xs text-gray-500">
                        입력하지 않으면 자체 번역 패널이 렌더링되며, URL을
                        입력하면 새 창으로 해당 링크가 열립니다.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="space-y-0.5">
                    <Label className="text-base font-semibold">
                      디지털 명찰 메뉴 노출
                    </Label>
                    <p className="text-sm text-gray-500">
                      디지털 명찰(토큰 URL / 마이페이지)에서 각 메뉴를 노출 또는
                      숨김으로 제어합니다.
                    </p>
                  </div>
                  <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-2">
                    {(
                      [
                        { key: "status", label: "상태" },
                        { key: "sessions", label: "수강" },
                        { key: "materials", label: "자료" },
                        { key: "program", label: "일정" },
                        { key: "translation", label: "번역" },
                        { key: "stampTour", label: "메뉴" },
                        { key: "home", label: "학술대회 홈페이지로 이동" },
                        { key: "qna", label: "Q&A" },
                        { key: "certificate", label: "참가확인서" },
                      ] as const
                    ).map((item) => (
                      <div
                        key={item.key}
                        className="rounded-lg bg-white px-3 py-2 shadow-sm space-y-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-gray-700">
                            {item.label}
                          </span>
                          <input
                            type="checkbox"
                            checked={!!menuVisibility[item.key]}
                            onChange={(event) =>
                              setMenuVisibility((prev) => ({
                                ...prev,
                                [item.key]: event.target.checked,
                              }))
                            }
                            className="h-5 w-5 rounded text-blue-600"
                          />
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <Input
                            value={menuLabels[item.key]?.ko || ""}
                            onChange={(event) =>
                              setMenuLabels((prev) => ({
                                ...prev,
                                [item.key]: {
                                  ...prev[item.key],
                                  ko: event.target.value,
                                },
                              }))
                            }
                            placeholder="KR"
                          />
                          <Input
                            value={menuLabels[item.key]?.en || ""}
                            onChange={(event) =>
                              setMenuLabels((prev) => ({
                                ...prev,
                                [item.key]: {
                                  ...prev[item.key],
                                  en: event.target.value,
                                },
                              }))
                            }
                            placeholder="EN"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="print">
            <Card>
              <CardHeader>
                <CardTitle>출력 명찰 설정</CardTitle>
                <CardDescription>
                  명찰 에디터와 출력 레이아웃 사용 여부를 관리합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
                  <h3 className="mb-2 font-semibold text-blue-900">
                    명찰 에디터
                  </h3>
                  <p className="mb-4 text-sm text-blue-700">
                    배경, 필드 위치, 텍스트 스타일을 시각적으로 조정할 수
                    있습니다.
                  </p>
                  <Button
                    onClick={() => navigate(`/admin/conf/${cid}/badge-editor`)}
                    className="w-full"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    명찰 에디터 열기
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      출력 레이아웃 사용
                    </Label>
                    <input
                      type="checkbox"
                      checked={badgeLayoutEnabled}
                      onChange={(event) =>
                        setBadgeLayoutEnabled(event.target.checked)
                      }
                      className="h-5 w-5 rounded text-blue-600"
                    />
                  </div>
                  <p className="text-sm text-gray-500">
                    켜면 에디터에서 저장한 출력 명찰 레이아웃을 사용합니다.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>출력 명찰 미리보기</CardTitle>
                <CardDescription>
                  저장한 레이아웃이 실제 명찰에 어떻게 반영되는지 확인합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex min-h-[400px] items-center justify-center overflow-auto rounded-xl bg-gray-100 p-8">
                  {info?.badgeLayout ? (
                    <div className="origin-center scale-75 bg-white shadow-2xl">
                      <BadgeTemplate
                        data={{
                          registrationId: "PREVIEW-123",
                          name: "홍길동",
                          org: "대한의학회",
                          category: "학회 참가자",
                          LICENSE: "12345",
                          PRICE: "50,000원",
                        }}
                        config={convertBadgeLayoutToConfig(info.badgeLayout)}
                        rawElements={info.badgeLayout.elements}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-10 text-gray-500">
                      <Settings className="mb-4 h-12 w-12 text-gray-300" />
                      <p>저장된 출력 명찰 레이아웃이 없습니다.</p>
                      <Button
                        variant="link"
                        onClick={() =>
                          navigate(`/admin/conf/${cid}/badge-editor`)
                        }
                      >
                        명찰 에디터에서 설정하기
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-4 shadow-lg">
          <div className="mx-auto flex max-w-6xl justify-end gap-3">
            <Button variant="outline" onClick={() => navigate(-1)}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  저장하기
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BadgeManagementPage;
