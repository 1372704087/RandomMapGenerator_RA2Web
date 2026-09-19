// 0x598030 NextUniformRange size=61

unsigned int __fastcall sub_598030(int a1, unsigned int a2)
{
  double v3; // st7
  unsigned int result; // eax
  __int64 v5; // [esp+8h] [ebp-18h]
  __int64 v6; // [esp+8h] [ebp-18h]
  double v7; // [esp+10h] [ebp-10h]
  double v8; // [esp+18h] [ebp-8h]

  v5 = a2 - a1 + 1;
  v3 = (double)v5;
  LODWORD(v5) = a1;
  v7 = v3;
  v8 = (double)v5;
  do
  {
    v6 = (unsigned int)sub_65C780(&unk_ABE890);
    result = sub_7C5F00((double)v6 * v7 * 2.328306437080797e-10 + v8);
  }
  while ( result > a2 );
  return result;
}
