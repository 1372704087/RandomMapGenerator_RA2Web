// 0x58c6f0 Region_SplitCost size=10F

double __stdcall sub_58C6F0(__int16 *a1, __int16 *a2, double a3)
{
  double v3; // st7
  double v4; // st7
  double v5; // st7
  char v7; // c0
  int v9; // [esp+Ch] [ebp-10h]
  double v10; // [esp+14h] [ebp-8h]
  int v11; // [esp+24h] [ebp+8h]
  double v12; // [esp+28h] [ebp+Ch]

  v9 = *a2 - *a1;
  v11 = a2[1] - a1[1];
  v3 = (double)(v9 * v9 + v11 * v11);
  sub_4CAC40(v3);
  v10 = v3;
  if ( v9 != 0 )
  {
    v4 = -((double)v11 / (double)v9);
    sub_4CADE0(v4);
    if ( v9 < 0 )
      v4 = 3.141592653589793 - (double)v11 / (double)v9;
  }
  else
  {
    v4 = 1.570796326794897;
  }
  v5 = fabs(v4 - a3);
  v12 = v5;
  if ( v7 == 0 )
  {
    do
      v5 = v5 - 6.283185307179586;
    while ( v5 >= 6.283185307179586 );
    v12 = v5;
  }
  if ( v5 > 3.141592653589793 )
    v12 = 6.283185307179586 - v5;
  return (double)(unsigned int)sub_65C780(&unk_ABE890) * 2.328306437080797e-10 * 2.5 + 1.5 * v12 + 0.15 * v10;
}
