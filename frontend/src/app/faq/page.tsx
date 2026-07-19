"use client";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { IconChevronDown } from "@/components/ui/icons";

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Сарын багц идэвхжүүлбэл юу үзэх боломжтой вэ?",
    a: "Багцад орсон бүх кино, цувралыг хугацааныхаа туршид хязгааргүй үзнэ. Зарим онцгой кино багцад ороогүй, зөвхөн түрээсээр гардаг — тэдгээрийн постер дээр үнэ нь харагдана.",
  },
  {
    q: "Түрээс гэж юу вэ, хэрхэн ажилладаг вэ?",
    a: "Түрээс нь нэг киног нэг удаагийн төлбөрөөр тодорхой хугацаанд (ихэвчлэн 48 цаг) үзэх эрх юм. Төлбөр баталгаажсан мөчөөс хугацаа тоологдож эхэлнэ, дуустал хэдэн ч удаа үзэж болно.",
  },
  {
    q: "Төлбөрөө хэрхэн төлөх вэ?",
    a: "Бүх төлбөр QPay-ээр хийгдэнэ. Төлбөрийн цонхонд гарч ирэх QR кодыг банкныхаа аппаар уншуулах эсвэл жагсаалтаас банкаа сонгоход апп руу шууд үсэрнэ. Төлбөр баталгаажмагц эрх тань автоматаар нээгдэнэ.",
  },
  {
    q: "Багц маань дуусахад юу болох вэ?",
    a: "Хугацаа дууссаны дараа контент түгжигдэнэ, харин таны жагсаалт, үзсэн түүх бүгд хадгалагдана. Эрх сунгах хуудаснаас шинэ багц авахад шинэ хугацаа одоогийн эрхийн дээр нэмэгдэнэ.",
  },
  {
    q: "Хэдэн төхөөрөмж дээр үзэж болох вэ?",
    a: "Багц тус бүр өөрийн төхөөрөмжийн хязгаартай — багцын карт дээр бичсэн байгаа. Утас, таблет, компьютер аль ч төхөөрөмжөөс нэвтэрч үзэж болно.",
  },
  {
    q: "Төлбөр буцаан олголт байдаг уу?",
    a: "Техникийн саатлаас болж үйлчилгээ авч чадаагүй тохиолдолд бидэнтэй холбогдоорой — нөхцөл байдлыг шалгаад эрх сунгах эсвэл буцаан олголт хийнэ. Идэвхжсэн, хэвийн ажиллаж буй эрхэд буцаан олголт хийгдэхгүй.",
  },
];

export default function FaqPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-10">
        <PageHeader eyebrow="Тусламж" title="Түгээмэл асуултууд" />

        <div className="mt-8 space-y-3">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-line bg-surface/70 transition open:border-accent/30 open:bg-surface-raised/50"
            >
              <summary className="flex items-center gap-3 px-5 py-4 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{item.q}</span>
                <IconChevronDown
                  size={17}
                  className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180 group-open:text-accent"
                />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted">
                {item.a}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-line bg-surface/70 p-6 text-center">
          <p className="text-sm font-bold text-foreground">
            Асуулт тань энд алга уу?
          </p>
          <p className="mt-1 text-xs text-muted">
            Үйлчилгээний нөхцөлөөс дэлгэрэнгүй мэдээлэл авах боломжтой.
          </p>
          <ButtonLink href="/terms" variant="outline" size="sm" className="mt-4">
            Үйлчилгээний нөхцөл харах
          </ButtonLink>
        </div>
      </div>
    </AppShell>
  );
}
